# T-Rexx World Engine — Source and Attribution Notice

T-Rexx World Engine is a derivative work built from the public God's Eye View codebase.

## Code lineage

- Immediate audited source: `uhrichsam4/gods-eye-view`
- Baseline commit: `5804ba8811235983505b676e02e855d8986de21e`
- Baseline URL: https://github.com/uhrichsam4/gods-eye-view/commit/5804ba8811235983505b676e02e855d8986de21e
- Original project identified by the baseline package metadata: `bilawalsidhu/gods-eye-view`
- Original project URL: https://github.com/bilawalsidhu/gods-eye-view

The source code is distributed under the MIT License included in `LICENSE`. The existing copyright notice for Bilawal Sidhu must remain in copies or substantial portions of the software. Later T-Rexx World Engine contributions do not remove or replace upstream rights or attribution.

The `uhrichsam4/gods-eye-view` repository is represented by GitHub as a standalone repository rather than a formal fork. This notice records the actual source snapshot used even when GitHub's fork-network metadata does not.

## Third-party data and assets

The MIT license applies to source code only. It does not relicense bundled datasets, live provider data, map tiles, media, trademarks, or 3D models. Their individual terms and attribution requirements remain in force.

See:

- `DATA_SOURCES.md`
- `public/models/README.md`
- `docs/media/README.md`
- the third-party carve-outs in `LICENSE`

Commercial deployments must complete a fresh provider-by-provider review. In particular, the baseline includes or integrates data with NonCommercial, ODbL, proprietary, attribution, caching, and usage-limit requirements.

## T-Rexx calculation dependency

AstroEye schedule discovery uses [TheSportsDB](https://www.thesportsdb.com/) official API. Schedule/venue data follow [provider terms](https://www.thesportsdb.com/docs_terms_of_use.php), not the MIT code license. The free development key has limited results; app-store publication requires a paid subscription. The implementation imports factual event/venue fields, not provider artwork. See [schedule documentation](docs/architecture/astroeye-sports-schedules.md).

AstroEye uses [Astronomy Engine](https://github.com/cosinekitty/astronomy) by Don Cross under the MIT License. The calculation result records the engine name and exact package version. This dependency is not Swiss Ephemeris and does not grant rights to Swiss Ephemeris data or code.

Development tests use [fake-indexeddb](https://github.com/dumbmatter/fakeIndexedDB) under the Apache License 2.0. It is a test-only dependency and is not part of the production browser bundle.

Independent planetary-position tests retain reference responses from the NASA/JPL Solar System Dynamics Group's [Horizons service](https://ssd.jpl.nasa.gov/horizons/). Original responses, attribution, query parameters, and retrieval times are stored in `src/modules/astroeye/calculation/fixtures/horizons/`. These reference data are not relicensed by the MIT code license. The [SSD API policy](https://ssd-api.jpl.nasa.gov/doc/) applies to reference collection; the browser application does not call Horizons. See [the validation report](docs/architecture/astroeye-validation.md) for scope and measured agreement.
