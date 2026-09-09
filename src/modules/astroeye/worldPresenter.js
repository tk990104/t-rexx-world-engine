import * as Cesium from 'cesium';

import { flyToLandmark } from '../../locations.js';

export const ASTROEYE_EVENT_ENTITY_ID = 't-rexx-astroeye-selected-event';

/** Presents the selected AstroEye venue without taking ownership of live-feed time. */
export function createAstroEyeWorldPresenter({ viewer, navigate = flyToLandmark } = {}) {
  if (!viewer?.entities?.add || !viewer?.entities?.removeById) {
    throw new TypeError('AstroEye world presentation requires a Cesium viewer entity collection');
  }
  if (typeof navigate !== 'function') throw new TypeError('navigate must be a function');

  return async function presentEvent(event, chart) {
    viewer.entities.removeById(ASTROEYE_EVENT_ENTITY_ID);
    if (!event) {
      viewer.scene?.requestRender?.();
      return null;
    }

    const latitude = Number(event.venue.latitude);
    const longitude = Number(event.venue.longitude);
    const entity = viewer.entities.add({
      id: ASTROEYE_EVENT_ENTITY_ID,
      name: event.title,
      position: Cesium.Cartesian3.fromDegrees(longitude, latitude, 80),
      point: {
        color: Cesium.Color.fromCssColorString('#d6a6ff'),
        outlineColor: Cesium.Color.fromCssColorString('#160523'),
        outlineWidth: 3,
        pixelSize: 14,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      label: {
        text: `${event.title}\n${event.scheduledLocal.date} ${event.scheduledLocal.time.slice(0, 5)} ${event.scheduledLocal.timeZone}`,
        font: '600 13px JetBrains Mono',
        fillColor: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.fromCssColorString('#160523'),
        outlineWidth: 4,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        pixelOffset: new Cesium.Cartesian2(0, -34),
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      properties: {
        moduleId: 'astroeye',
        eventId: event.id,
        chartId: chart?.chartId ?? null,
        utcStart: event.utcStart,
      },
    });

    navigate(viewer, latitude, longitude, {
      range: 12000,
      pitch: -42,
      heading: 12,
      buildingHeight: 0,
      duration: 2.4,
    });
    viewer.scene?.requestRender?.();
    return entity;
  };
}
