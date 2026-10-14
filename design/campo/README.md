# Campo: the design reference

The five artboards of design direction 1, "Campo", chosen by Ross on 2026-10-14 over
two other directions on the design canvas
(https://claude.ai/artifact/Hw7LgYnu3QzndKq2AJyEvt, row 1). They are the source the
Campo epic builds from; the two rejected directions on the canvas are never read as
precedent.

- `style-tile.html`: the palette, the type, the answer-row states, the buttons and the
  tab bar, with the rules in a few words.
- `home.html`, `practice.html`, `exam.html`, `progress.html`: one phone screen each,
  390 px wide, in the light theme.

They are written in the canvas's own component format: `<x-dc>`, `<helmet>`, `<sc-for>`,
`<sc-if>` and `{{holes}}` filled by the `renderVals()` of the script at the end of each
file, so a browser opened on them shows the static parts only. Read them for the
values: colours, sizes, spacing, weights and the markup of each piece. The exact rules
are in `DESIGN.md` § 8.5 and the epic's DECISIONS; where a file and `DESIGN.md`
disagree, `DESIGN.md` wins.

The picture in `practice.html` is the bank's `q168.jpg`, linked relatively.
