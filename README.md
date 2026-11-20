# Interview Practice Room

A private, browser-only room for practicing job interviews. Pick a role and a level, answer out loud or in writing, and read feedback that stays on your device.

## Who it is for

People preparing for interviews: students, career changers, and anyone who wants to hear how an answer actually sounds. The question bank covers software engineering, frontend, backend, data engineering, machine learning, DevOps, cybersecurity, product management, nursing, medical assisting, electrician apprenticeships, sales, customer service, teaching, and general behavioral interviews.

Clinical and trade questions are for interview practice. They are not instructions for the job.

## What you can do

- Choose a role and a level (entry, mid-level, or senior).
- Practice 1, 3, or 5 questions, or start a mock interview of 5 questions.
- Keep time while you answer.
- Record with the microphone and transcribe on this device, or type the answer.
- Read a local score: speaking or drafting pace, filler phrases (um, uh, like, you know, basically), pauses in a recording, length against the usual window, STAR cues, and coverage of the question’s key points.
- See what interviewers look for, plus a model answer outline.
- Keep finished sessions in this browser and export a summary with the print dialog (save as PDF from there).

The bank has 360 original questions. Each one includes an interviewer note, an outline, and key points.

## Privacy

- The recording and the transcript never leave the browser. There is no account and no upload of audio.
- Transcription uses Whisper tiny English or base English through Transformers.js, inside a Web Worker. The model files download from Hugging Face the first time you transcribe, then the browser cache keeps them.
- The speech runtime’s WebAssembly files load from jsDelivr, pinned to the installed onnxruntime-web version.
- Session history is stored in `localStorage` on this browser. Clearing site data removes it.
- No API key is required.

## How to use it

1. Choose a role, a level, and either a practice set or a mock interview.
2. Read the question. Record an answer, or type one. The clock starts when you record or type.
3. If you recorded, choose Tiny English or Base English and transcribe on this device. You can edit the text before asking for feedback.
4. Read the score, the tips, the interviewer note, and the outline. Continue to the next question or finish.
5. Open History to review a past session, delete it, or export a summary.

If the microphone or the speech model is unavailable, type the answer. Feedback still runs.

## Develop and build

```bash
npm install
npm test
npm run build
```

`npm test` runs the analyzer, pause, scoring, and question-bank checks. `npm run build` typechecks, writes a static site to `dist/`, and fails if any output file is over 25 MiB.

The Vite `base` is `./`, so the same build works at the root of a host and in a subpath.

## Hosting

This is a static site for Cloudflare Pages.

- Build command: `npm run build`
- Output directory: `dist`
- No environment variables

`public/_headers` is copied into the build. It sets a strict content security policy (including `wasm-unsafe-eval` for the speech runtime, and `blob:` workers), `Permissions-Policy: microphone=(self)`, and connect rules limited to this site, jsDelivr for the speech runtime, and Hugging Face hosts used to download the speech model.

Upload the same `dist` output for both:

- `interview.aiteksolutions.net` (site root)
- `aiteksolutions.net/interview/` (the files live under that path)

Relative asset paths cover both addresses. On the subpath host, the Pages project output root should be the interview folder so `_headers` still applies to that deployment.
