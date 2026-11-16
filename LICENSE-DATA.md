# Dictionary data license

This project includes a reduced, application-specific reconstruction of the `data/core.json` dataset from [faanau/yojijukugo-db](https://github.com/faanau/yojijukugo-db).

- Project: yojijukugo-db
- Author: faanau
- Original dictionary sources: JMdict / KANJIDIC2
- Original data provider: Electronic Dictionary Research and Development Group (EDRDG)
- Data license: [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)

The local `dictionary.json` keeps the fields required by this application (`headword`, `variants`, `chars`, `reading`, and `gloss`) and omits unused KANJIDIC2 detail fields. The data is therefore a processed and reconstructed subset of the upstream dataset and remains subject to CC BY-SA 4.0. The source code of this application is separate from the dictionary data license.

The upstream data should be refreshed reasonably in line with EDRDG releases when this application is updated.
