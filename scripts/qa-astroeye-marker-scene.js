import * as Cesium from 'cesium';
import { EventBus } from '../src/core/eventBus.js';
import { createResearchAnnotationLayer, researchNoteEntityId } from '../src/modules/astroeye/researchAnnotationLayer.js';
import { RESEARCH_ANNOTATIONS_ID } from '../src/modules/astroeye/researchAnnotations.js';

/** QA-only offline fixture: in-memory records by default, optional isolated test loader. Never imported by main. */
export function mountMarkerScene(host, { eventBus = new EventBus(), loadAnnotations } = {}) {
  const viewer = new Cesium.Viewer(host, {
    baseLayer: false, baseLayerPicker: false, terrainProvider: new Cesium.EllipsoidTerrainProvider(),
    animation: false, timeline: false, geocoder: false, homeButton: false, sceneModePicker: false,
    navigationHelpButton: false, fullscreenButton: false, selectionIndicator: false, infoBox: false,
    skyBox: false, skyAtmosphere: false, requestRenderMode: false,
    contextOptions: { webgl: { preserveDrawingBuffer: true } },
  });
  viewer.targetFrameRate = 20;
  viewer.clock.shouldAnimate = false;
  viewer.scene.globe.show = false;
  // A synchronous WGS84 reference mesh avoids asynchronous terrain workers in this
  // rendering-only fixture. It is a real depth-tested Cesium primitive, not imagery.
  const earth = viewer.scene.primitives.add(new Cesium.Primitive({ asynchronous: false,
    geometryInstances: new Cesium.GeometryInstance({ id: 'qa-reference-ellipsoid',
      geometry: new Cesium.EllipsoidGeometry({ radii: Cesium.Ellipsoid.WGS84.radii, stackPartitions: 128, slicePartitions: 256,
        vertexFormat: Cesium.PerInstanceColorAppearance.FLAT_VERTEX_FORMAT }),
      attributes: { color: Cesium.ColorGeometryInstanceAttribute.fromColor(Cesium.Color.fromCssColorString('#123147')) } }),
    appearance: new Cesium.PerInstanceColorAppearance({ flat: true, closed: true, translucent: false }),
  }));
  viewer.scene.backgroundColor = Cesium.Color.fromCssColorString('#060e19');
  viewer.scene.globe.enableLighting = false;
  viewer.scene.fog.enabled = false;
  const renderErrors = [];
  viewer.scene.renderError.addEventListener((_scene, error) => renderErrors.push(String(error.message).slice(0, 300)));
  viewer.camera.lookAt(Cesium.Cartesian3.fromDegrees(-75, 40, 0), new Cesium.HeadingPitchRange(0, -Math.PI / 3, 100000));
  viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
  let reads = 0;
  const records = { id: RESEARCH_ANNOTATIONS_ID, kind: 'astroeye-event-annotations', schemaVersion: 1,
    annotations: [[40.22, -75.34], [40, -75], [39.78, -74.66]].map(([latitude, longitude], i) => ({
      id: `astroeye-note:render-${i}`, schemaVersion: 1, eventId: `synthetic-${i}`,
      chartTimeUtc: `2026-09-15T1${i}:00:00.000Z`, latitude, longitude, note: 'PRIVATE-SYNTHETIC-NOTE',
    })) };
  const layer = createResearchAnnotationLayer({ viewer, eventBus,
    loadAnnotations: async () => { reads++; return loadAnnotations ? loadAnnotations() : structuredClone(records); },
    modeTarget: document.body, canDisplay: () => !document.body.classList.contains('scene-playback-mode'),
  });
  const camera = () => ({ position: Cesium.Cartesian3.clone(viewer.camera.positionWC),
    direction: Cesium.Cartesian3.clone(viewer.camera.directionWC), up: Cesium.Cartesian3.clone(viewer.camera.upWC) });
  function pointFor(note) {
    const position = Cesium.Cartesian3.fromDegrees(note.longitude, note.latitude, 100);
    const pixel = viewer.scene.cartesianToCanvasCoordinates(position);
    if (!pixel) return null;
    const picked = viewer.scene.pick(pixel);
    return { id: researchNoteEntityId(note.id), x: pixel.x, y: pixel.y,
      picked: picked?.id?.id === researchNoteEntityId(note.id) };
  }
  const points = () => records.annotations.map(pointFor);
  return { viewer, layer, camera, points, pointFor, reads: () => reads,
    async coincide() {
      records.annotations.forEach((note) => { note.latitude = 40; note.longitude = -75; });
      await layer.refresh();
    },
    visibleLabels: () => viewer.entities.values.filter((entity) => entity.label?.show.getValue())
      .map((entity) => ({ id: entity.id, text: entity.label.text.getValue() })),
    scene3D: () => viewer.scene.mode === Cesium.SceneMode.SCENE3D,
    diagnostics: () => ({ renderErrors, referenceReady: earth.ready, globeShown: viewer.scene.globe.show,
      cameraHeight: viewer.camera.positionCartographic.height, terrain: viewer.terrainProvider.constructor.name }),
    surfaceReady: () => earth.ready && viewer.scene.pick(new Cesium.Cartesian2(
      viewer.scene.canvas.clientWidth / 2 + 80, viewer.scene.canvas.clientHeight / 2 + 80))?.id === 'qa-reference-ellipsoid',
    faceAway() {
      viewer.camera.lookAt(Cesium.Cartesian3.fromDegrees(105, -40, 0), new Cesium.HeadingPitchRange(0, -Math.PI / 2, 12000000));
      viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY); viewer.scene.requestRender();
    },
    render: () => viewer.scene.requestRender(),
    destroy() { layer.destroy(); viewer.destroy(); },
  };
}
