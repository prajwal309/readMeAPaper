// Sonora's client-side demo reader.
// The production version would send paper extraction and TTS requests to a
// server. This prototype keeps the UI interactive and uses arXiv metadata
// when the browser can reach the public API.

const demoPaper = {
  id: '2001.08361',
  title: 'The surprising effectiveness of scaling laws in neural language models',
  authors: 'A. Kaplan, S. McCandlish, T. Henighan',
  date: '2020',
  abstract:
    'Recent work has demonstrated impressive performance gains from increasing the scale of language models. We study how these gains depend on model size, dataset size, and compute, finding simple power-law relationships that span more than seven orders of magnitude.',
};

// Each section stores: [number-or-label, title/description, description/time].
const sections = [
  ['Abstract', 'A clear overview of the research and its key findings.', '01:14'],
  ['1', 'Introduction', 'Why scale is the next frontier for language models.', '02:31'],
  ['2', 'Model and data', 'The experimental setup and training details.', '03:08'],
  ['3', 'Results', 'What the scaling laws reveal about performance.', '04:22'],
  ['4', 'Discussion', 'Implications, limitations, and open questions.', '02:16'],
  ['5', 'Conclusions', 'The central takeaways from this work.', '01:09'],
];

let currentSection = 0;
let isPlaying = false;
let elapsedSeconds = 0;
let playbackTimer;
let activeMode = 'full';
let readingRate = 1;
let activeUtterance;

const $ = (selector) => document.querySelector(selector);

/** Display a short, non-blocking message at the bottom of the screen. */
function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(window.sonoraToastTimer);
  window.sonoraToastTimer = setTimeout(() => toast.classList.remove('show'), 2400);
}

function sectionTitle(section) {
  return section[0] === 'Abstract' ? 'Abstract' : section[1];
}

function sectionDescription(section) {
  return section[0] === 'Abstract' ? section[1] : section[2];
}

function sectionDuration(section) {
  return section[0] === 'Abstract' ? section[2] : section[3];
}

/** Build a short narration for the currently selected section. */
function sectionNarration(section) {
  if (section[0] === 'Abstract') {
    return `Abstract. ${demoPaper.abstract}`;
  }

  return `${section[1]}. ${section[2]} This section explains the main ideas and findings of the paper.`;
}

/** Speak the current section using the browser's installed voice output. */
function speakCurrentSection() {
  if (!('speechSynthesis' in window)) {
    showToast('Speech playback is not supported in this browser');
    return;
  }

  window.speechSynthesis.cancel();
  activeUtterance = new SpeechSynthesisUtterance(
    sectionNarration(sections[currentSection]),
  );
  activeUtterance.rate = readingRate;
  activeUtterance.pitch = 1;
  activeUtterance.onend = () => {
    if (!isPlaying) return;
    if (currentSection < sections.length - 1) {
      currentSection += 1;
      elapsedSeconds = 0;
      updatePlayer();
      speakCurrentSection();
    } else {
      isPlaying = false;
      updatePlayer();
    }
  };
  window.speechSynthesis.speak(activeUtterance);
}

/** Render the table of contents and attach section-jump interactions. */
function renderSections() {
  $('#sectionList').innerHTML = sections
    .map(
      (section, index) => `
        <div class="section-row ${index === currentSection ? 'current' : ''}" data-index="${index}">
          <span class="section-num">${String(index + 1).padStart(2, '0')}</span>
          <div class="section-copy">
            <h4>${sectionTitle(section)}</h4>
            <p>${sectionDescription(section)}</p>
          </div>
          <span class="row-time">${sectionDuration(section)}</span>
          <span class="row-play">${index === currentSection && isPlaying ? '❚❚' : '▶'}</span>
        </div>`,
    )
    .join('');

  document.querySelectorAll('.section-row').forEach((row) => {
    row.addEventListener('click', () => {
      currentSection = Number(row.dataset.index);
      isPlaying = true;
      updatePlayer();
      startPlaybackTimer();
      speakCurrentSection();
      showToast(`Playing ${sectionTitle(sections[currentSection]).toLowerCase()}`);
    });
  });
}

/** Keep the fixed player and the highlighted section synchronized. */
function updatePlayer() {
  $('#playerSection').textContent = sectionTitle(sections[currentSection]);
  $('#playerTitle').textContent = demoPaper.title;
  $('#playBtn').textContent = isPlaying ? '❚❚' : '▶';
  renderSections();
}

/** Simulate progressive playback for the prototype player. */
function startPlaybackTimer() {
  clearInterval(playbackTimer);
  playbackTimer = setInterval(() => {
    if (!isPlaying) return;

    elapsedSeconds += 1;
    if (elapsedSeconds > 760) {
      elapsedSeconds = 0;
      currentSection = Math.min(currentSection + 1, sections.length - 1);
      updatePlayer();
    }

    const minutes = String(Math.floor(elapsedSeconds / 60)).padStart(2, '0');
    const seconds = String(elapsedSeconds % 60).padStart(2, '0');
    const progressPercent = Math.min(92, 18 + elapsedSeconds / 12);

    $('#currentTime').textContent = `${minutes}:${seconds}`;
    $('#progress').style.width = `${progressPercent}%`;
    $('.scrubber').style.left = `${progressPercent}%`;
  }, 1000);
}

/** Accept /abs URLs, /pdf URLs, versioned IDs, and bare arXiv IDs. */
function normalizeArxivId(value) {
  const match = value.trim().match(
    /(?:arxiv\.org\/(?:abs|pdf)\/)?([0-9]{4}\.[0-9]{4,5})(?:v\d+)?/i,
  );
  return match ? match[1] : null;
}

/** Read basic metadata from the public arXiv Atom response. */
function parseArxivMetadata(xml) {
  const title = xml
    .match(/<title>([\s\S]*?)<\/title>/g)?.[1]
    ?.replace(/<\/?title>/g, '')
    .trim();
  const authors = [...xml.matchAll(/<author>\s*<name>(.*?)<\/name>/g)]
    .map((match) => match[1])
    .slice(0, 3)
    .join(', ');
  const abstract = xml.match(/<summary>([\s\S]*?)<\/summary>/)?.[1]
    ?.replace(/\s+/g, ' ')
    .trim();

  return { title, authors, abstract };
}

/** Load paper metadata without making the interface depend on the network. */
async function loadPaper(event) {
  event.preventDefault();
  const id = normalizeArxivId($('#urlInput').value);

  if (!id) {
    showToast('Please enter a valid arXiv ID or URL');
    return;
  }

  showToast('Finding your paper…');

  try {
    // The local server proxies this request to avoid browser CORS restrictions.
    const response = await fetch(`/api/arxiv?id=${encodeURIComponent(id)}`);
    const metadata = parseArxivMetadata(await response.text());

    if (!metadata.title) throw new Error('No paper metadata returned');

    demoPaper.id = id;
    demoPaper.title = metadata.title.replace(/\s+/g, ' ');
    demoPaper.authors = metadata.authors || 'arXiv author list';
    demoPaper.abstract = metadata.abstract || demoPaper.abstract;
    $('#paperTitle').textContent = demoPaper.title;
    $('#paperAuthors').textContent = `${demoPaper.authors}  ·  arXiv`;
    $('#paperId').textContent = id;
    $('#abstractText').textContent = demoPaper.abstract;
    $('#playerTitle').textContent = demoPaper.title;
    showToast('Paper found — ready to listen');
  } catch (error) {
    // A blocked CORS request should not break the demo; the normalized ID is
    // still shown and the reader remains usable with the sample content.
    demoPaper.id = id;
    $('#paperId').textContent = id;
    showToast('Loaded in preview mode — metadata is ready to explore');
  }
}

$('#urlForm').addEventListener('submit', loadPaper);

$('#clearBtn').addEventListener('click', () => {
  $('#urlInput').value = '';
  $('#urlInput').focus();
});

$('#playBtn').addEventListener('click', () => {
  isPlaying = !isPlaying;
  updatePlayer();

  if (isPlaying) {
    startPlaybackTimer();
    // Resume an existing utterance after pause; otherwise start the section.
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    } else {
      speakCurrentSection();
    }
    showToast(`Playing ${sectionTitle(sections[currentSection]).toLowerCase()}`);
  } else {
    window.speechSynthesis?.pause();
    showToast('Playback paused');
  }
});

$('#backBtn').addEventListener('click', () => {
  elapsedSeconds = Math.max(0, elapsedSeconds - 15);
  showToast('Skipped back 15 seconds');
});

$('#nextBtn').addEventListener('click', () => {
  elapsedSeconds += 15;
  showToast('Skipped forward 15 seconds');
});

$('#progressTrack').addEventListener('click', (event) => {
  const track = event.currentTarget.getBoundingClientRect();
  elapsedSeconds = Math.round(((event.clientX - track.left) / track.width) * 760);
});

$('#saveBtn').addEventListener('click', (event) => {
  const button = event.currentTarget;
  const saved = button.classList.toggle('saved');
  button.innerHTML = saved ? '♥ <span>Saved</span>' : '♡ <span>Save</span>';
  showToast(saved ? 'Saved to your library' : 'Removed from library');
});

document.querySelectorAll('.mode').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.mode').forEach((item) => item.classList.remove('active'));
    button.classList.add('active');
    activeMode = button.dataset.mode;
    $('#modeDescription').textContent = {
      full: 'The complete paper, narrated clearly and at a comfortable pace.',
      essential: 'The essential ideas, findings, and conclusions — without the detours.',
      summary: 'A focused 5–10 minute explanation of the research and why it matters.',
    }[activeMode];
    showToast(`${button.textContent} mode selected`);
  });
});

document.querySelectorAll('.voice').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.voice').forEach((item) => item.classList.remove('selected'));
    button.classList.add('selected');
    showToast(`${button.dataset.voice} voice selected`);
  });
});

document.querySelectorAll('.speed-options button').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.speed-options button').forEach((item) => item.classList.remove('selected'));
    button.classList.add('selected');
    readingRate = Number.parseFloat(button.textContent);
    if (activeUtterance && window.speechSynthesis.speaking) {
      // SpeechSynthesis does not update an utterance in place, so restart the
      // current section with the new rate.
      speakCurrentSection();
    }
    showToast(`Reading speed set to ${button.textContent}`);
  });
});

$('#previewBtn').addEventListener('click', () => {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const preview = new SpeechSynthesisUtterance('Welcome to Sonora, your research listening room.');
    preview.rate = readingRate;
    window.speechSynthesis.speak(preview);
  }
  showToast('Voice preview playing');
});
$('#searchBtn').addEventListener('click', () => showToast('Search is coming to your library'));

// Initial render: the demo is ready before a network request is made.
renderSections();
updatePlayer();
