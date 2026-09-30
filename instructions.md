Build a polished web application that allows a user to paste an arXiv paper URL and immediately listen to the paper being read aloud in a natural human voice.

The product should feel like an audiobook player for scientific papers.

## Core user experience

The landing page should contain:

- A large input box saying: "Paste an arXiv link"
- A primary button: "Listen to Paper"
- Example input such as:
  `https://arxiv.org/abs/2501.12345`
- A clean, modern interface optimized for desktop and mobile.

When a user submits an arXiv URL:

1. Extract and validate the arXiv ID.
2. Fetch the paper metadata:
   - title
   - authors
   - abstract
   - publication/submission date
   - arXiv identifier
3. Retrieve the paper content.
4. Parse it into logical sections.
5. Convert the scientific text into speech-friendly text.
6. Begin generating audio as soon as the first section is ready.
7. Start playback without waiting for the entire paper to be synthesized.

The user should see the paper title and authors immediately while processing occurs.

## Paper retrieval

Support URLs in forms such as:

- `https://arxiv.org/abs/XXXX.XXXXX`
- `https://arxiv.org/pdf/XXXX.XXXXX`
- `http://arxiv.org/abs/XXXX.XXXXX`
- bare arXiv IDs such as `2501.12345`

Normalize all of these to a canonical arXiv ID.

Prefer structured arXiv HTML when it is available because it preserves headings, equations, captions, paragraphs, and document order better.

If HTML is unavailable, download the PDF and extract its contents.

For the PDF fallback, use a robust parser such as PyMuPDF rather than naïvely copying PDF text.

The extraction system must handle multi-column scientific PDFs correctly and avoid reading:

- page numbers
- repeating headers
- repeating footers
- journal boilerplate
- broken line endings
- hyphenation caused by line wrapping

Do not accidentally interleave text from two PDF columns.

## Scientific-document parser

Convert the paper into a structured representation similar to:

```ts
Paper {
  id
  title
  authors
  abstract
  sections: [
    {
      id
      heading
      paragraphs
      equations
      figures
      tables
    }
  ]
}
```

Recognize common sections such as:

- Abstract
- Introduction
- Background
- Methods
- Observations
- Data
- Results
- Discussion
- Conclusions
- Acknowledgements
- References

Use the paper's actual headings rather than assuming these sections always exist.

## Critical requirement: make scientific papers sound natural

DO NOT simply send raw extracted PDF text to text-to-speech.

Create a preprocessing layer specifically for scientific narration.

For example, this:

`T_eff = 2700 ± 150 K`

should become something like:

"the effective temperature is approximately twenty-seven hundred Kelvin, with an uncertainty of one hundred fifty Kelvin."

This:

`0.6–5.3 μm`

should be spoken as:

"zero point six to five point three microns."

This:

`M_J`

should be interpreted from context as:

"Jupiter masses"

when appropriate.

Handle common scientific notation including:

- Greek letters
- superscripts
- subscripts
- units
- wavelengths
- uncertainties
- powers of ten
- percentages
- chemical molecules
- astronomical symbols
- mathematical operators

Examples:

`H_2O` → "water"

`CO_2` → "carbon dioxide"

`10^{-4}` → "ten to the minus four"

`3.5 ± 0.4` → "three point five, plus or minus zero point four"

`R_\oplus` → "Earth radii"

`M_J` → "Jupiter masses"

`μm` → "microns"

`km s^{-1}` → "kilometers per second"

Do not literally read LaTeX commands aloud.

## Equations

Equations require special handling.

Simple equations should be translated into natural speech.

For example:

`F = L / 4πd²`

can become:

"Flux equals luminosity divided by four pi times distance squared."

For extremely complicated equations, do not read every raw symbol.

Instead say something like:

"Equation 4 defines the likelihood function in terms of the model residuals and covariance matrix."

Allow the user to choose:

- Simplify equations
- Read equations in detail
- Skip equations

Default to "Simplify equations."

Never invent an interpretation of an equation if the system is uncertain.

## Figures and tables

Do not silently ignore figures.

When encountering a figure, say something such as:

"Figure 2."

Then read its caption.

If sufficient text or structured information exists to describe the figure reliably, optionally provide a short description.

Example:

"Figure 2 shows atmospheric temperature as a function of pressure for three models."

Do not hallucinate information that cannot be determined from the document.

Tables should not be read cell-by-cell by default.

Instead:

1. announce the table,
2. read the caption,
3. optionally summarize its main structure.

Add settings:

- Read figure captions: on/off
- Read table captions: on/off

## Citations

Scientific prose often contains excessive citations.

Convert citations into natural narration.

For example:

`(Smith et al. 2024; Jones et al. 2025)`

could be spoken as:

"Smith and colleagues, twenty twenty-four, and Jones and colleagues, twenty twenty-five."

But add a user preference:

Citation reading:
- Skip citations
- Short citations
- Full citations

Default: Short citations.

Do NOT read the entire References section by default.

At the end of the paper, say:

"The references section has been omitted. You can enable reading references in settings."

## Audio generation

Use a high-quality neural text-to-speech provider.

Preferred architecture:

- OpenAI Text-to-Speech as the default provider
- create a provider abstraction so ElevenLabs or another TTS service can be added later

Never expose API keys in frontend JavaScript.

All TTS requests must go through the server.

Split narration into reasonably sized chunks, preferably by paragraph or semantic boundary.

Never split a sentence halfway through.

Generate audio incrementally:

Section 1 → generate → play

while

Section 2 → generate in background

while

Section 3 → waits in queue

The user should not have to wait for the entire paper.

Cache generated audio so replaying a section does not regenerate it unnecessarily.

Cache keys should include:

- arXiv ID
- arXiv version
- section
- voice
- speed
- narration settings

## Voices

Provide at minimum two clearly distinguishable voice choices in the UI:

- Female voice
- Male voice

Ideally provide 4–6 high-quality voices.

Each voice should have a short preview.

Also expose:

Reading speed:

- 0.75×
- 1×
- 1.25×
- 1.5×
- 1.75×
- 2×

Default: 1×.

The voice should sound calm and appropriate for long-form scientific listening rather than like an advertisement.

## Audio player

Create an audiobook-style persistent audio player.

It should include:

- Play / pause
- Skip forward 15 seconds
- Skip backward 15 seconds
- Previous section
- Next section
- Playback speed
- Volume
- Current time
- Remaining time
- Seek bar
- Section title
- Paper title

A waveform visualization is optional.

For playback, use either the browser's native Audio API or a mature audio library such as Howler.js.

Do not unnecessarily build an audio engine from scratch.

The player should continue playing when the user navigates between sections of the application.

## Paper navigation

Display a sidebar/table of contents:

Abstract
1. Introduction
2. Observations
3. Methods
4. Results
5. Discussion
6. Conclusions

Highlight the section currently being narrated.

Clicking a section should jump playback to that section.

Also highlight the current paragraph being narrated if practical.

## Listening modes

Provide three modes.

### Full Paper

Read essentially the entire scientific paper, excluding references by default.

### Essential Paper

Read:

- title
- abstract
- introduction
- main results
- discussion
- conclusions

Skip repetitive methodology and lengthy technical material where appropriate.

### Audio Summary

Generate a roughly 5–10 minute spoken explanation covering:

- research question
- why it matters
- method
- main findings
- limitations
- conclusions

Make it