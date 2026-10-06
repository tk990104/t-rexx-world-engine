import assert from 'node:assert/strict';
import { resolve } from 'node:path';

// Extends only the runner's owned full-app page. No OS settings, real profile or audio.
export async function checkFullAppAccessibility({ page, client, mode, session, manifest, mark, action, idle, records, readDownload }) {
  await page.waitForFunction(() => !!__godsEyeView.voiceCommands?.shortcutKeyDownHandler);
  await page.evaluate(id => __godsEyeView.astroEyeWorkspace.selectSavedEvent(id, { navigate: false, persistChart: false, houseSystem: 'equal' }), manifest.eventId);
  const baseline = await records();
  const key = async (selector, value = 'Enter') => { await page.focus(selector); await page.keyboard.press(value); await idle(); };
  const ax = async selector => {
    const { root } = await client.send('DOM.getDocument');
    const { nodeId } = await client.send('DOM.querySelector', { nodeId: root.nodeId, selector });
    assert.ok(nodeId, selector);
    const tree = await client.send('Accessibility.getPartialAXTree', { nodeId, fetchRelatives: true });
    return tree.nodes;
  };
  if (mode.startsWith('keyboard-')) {
    const width = mode === 'keyboard-narrow' ? 390 : 1280;
    await page.setViewport({ width, height: mode === 'keyboard-narrow' ? 844 : 900 });
    mark(`${mode}-guide-and-shortcuts`);
    await page.evaluate(() => {
      window.__qaKeys = [];
      for (const kind of ['keydown', 'keyup', 'click', 'toggle']) document.addEventListener(kind, event => {
        if (window.__qaKeys.length >= 24) return;
        queueMicrotask(() => window.__qaKeys.push({ kind, key: event.key, target: event.target.tagName,
          action: event.target.dataset?.action, prevented: event.defaultPrevented,
          focus: document.activeElement.tagName, open: document.querySelector('[data-role="quick-start"]').open }));
      }, true);
    });
    await key('[data-action="quick-start"]');
    assert.equal(await page.$eval('[data-role="quick-start"]', n => n.open), true);
    assert.equal(await page.evaluate(() => document.activeElement.tagName), 'SUMMARY');
    assert.match(await page.$eval('[data-role="quick-start"]', n => n.textContent), /Compare charts.*Saved events|Saved events.*Compare charts/s);
    await page.keyboard.press('Space');
    await page.waitForFunction(() => !document.querySelector('[data-role="quick-start"]').open);
    for (const [shortcut, target] of [['compare-charts', 'chart-comparison'], ['find-saved-events', 'saved-events-heading'], ['research-notes', 'research-notebook'], ['event-notes', 'event-notes']]) {
      await key(`[data-action="${shortcut}"]`);
      assert.equal(await page.evaluate(() => document.activeElement.dataset.role), target);
    }
    await page.waitForFunction(() => !document.querySelector('[data-annotation="reload"]').disabled);
    mark(`${mode}-accessibility-tree`);
    const required = ['[data-action="quick-start"]', '[data-action="compare-charts"]', '[data-action="find-saved-events"]', '[data-action="research-notes"]',
      '[data-action="event-notes"]', '[name="localDate"]', '[name="localTime"]', '[name="timeZone"]', '[data-role="event-notes"] textarea', '[data-role="research-notebook"] textarea', '.astroeye-chart svg'];
    const names = [];
    for (const selector of required) {
      const nodes = await ax(selector), node = nodes[0];
      assert.equal(node.ignored, false, selector); assert.ok(node.name?.value?.trim(), `Missing accessible name: ${selector}`);
      names.push({ selector, role: node.role.value, name: node.name.value });
    }
    await key('[data-action="time-forward"]');
    const status = await ax('.astroeye-live-status');
    assert.equal(status[0].role.value, 'status');
    assert.equal(status[0].properties.find(p => p.name === 'live')?.value.value, 'polite');
    assert.ok(status.some(n => /preview|saved|unchanged/i.test(n.name?.value || '')));
    mark(`${mode}-tab-visibility`);
    await page.focus('[data-action="close"]');
    const seen = new Set(); let outside = false;
    for (let i = 0; i < 130; i++) {
      await page.keyboard.press('Tab');
      const position = await page.evaluate(() => {
        const root = document.querySelector('#astroeye-workspace'), n = document.activeElement;
        if (!root.contains(n)) return { outside: true };
        const box = n.getBoundingClientRect(), area = root.getBoundingClientRect(), css = getComputedStyle(n);
        return { key: n.name || n.dataset.action || n.dataset.annotation || n.dataset.note || n.dataset.comparison || n.tagName,
          x: box.left, right: box.right, y: box.top, bottom: box.bottom, width: box.width, height: box.height,
          left: area.left, edge: area.right, top: area.top, end: area.bottom,
          outline: css.outlineStyle, outlineWidth: css.outlineWidth, shadow: css.boxShadow, type: n.type, visible: n.checkVisibility(),
          focus: n.matches(':focus'), within: n.matches(':focus-within'), focusVisible: n.matches(':focus-visible'), html: n.outerHTML };
      });
      if (position.outside) { outside = true; break; }
      seen.add(position.key);
      assert.ok(position.visible && position.width > 0 && position.height > 0, JSON.stringify(position));
      assert.ok(position.x >= position.left - 2 && position.right <= position.edge + 2 && position.y >= position.top - 2 && position.bottom <= position.end + 2, JSON.stringify(position));
      if (!((position.outline !== 'none' && parseFloat(position.outlineWidth) > 0) || position.shadow !== 'none')) {
        await page.screenshot({ path: resolve(session, `${mode}-focus-failure.png`) });
        assert.fail(`No focus indicator: ${JSON.stringify(position)}`);
      }
    }
    assert.ok(outside && seen.has('title') && seen.has('timeZone') && seen.has('compare-charts'), 'Tab sequence must expose fields/shortcuts and allow leaving the non-modal workspace');
    await key('[data-action="find-saved-events"]'); await page.keyboard.down('Shift'); await page.keyboard.press('Tab'); await page.keyboard.up('Shift');
    const reverse = await page.evaluate(() => {
      const n = document.activeElement, box = n.getBoundingClientRect(), root = document.querySelector('#astroeye-workspace');
      const header = root.querySelector(innerWidth <= 720 ? '.astroeye-header' : '.astroeye-quick-nav').getBoundingClientRect();
      return { top: box.top, header: header.bottom, name: n.textContent };
    });
    assert.ok(reverse.top >= reverse.header, JSON.stringify(reverse));
    const layout = await page.$eval('#astroeye-workspace', n => ({ client: n.clientWidth, scroll: n.scrollWidth }));
    assert.ok(layout.scroll <= layout.client + 1, JSON.stringify(layout));
    await page.screenshot({ path: resolve(session, `${mode}.png`) });
    await page.keyboard.press('Escape');
    assert.equal(await page.$eval('#astroeye-workspace', n => n.hidden), true);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'astroeye-entry-layers');
    assert.equal(await records(), baseline);
    return { passed: true, keyboardShortcuts: true, tabStops: seen.size, tabEscapeAndReturn: true, noPanelOverflow: true, names,
      browserLiveStatus: true, screenReaderSpeechVerified: false, width, screenshot: resolve(session, `${mode}.png`) };
  }
  if (mode === 'leave-warning') {
    mark('native-draft-download-and-leave-warning');
    await key('[data-action="research-notes"]');
    await page.waitForFunction(() => !document.querySelector('[data-role="research-notebook"] textarea').disabled);
    const draft = 'QA UNSAVED U2 NOTEBOOK';
    await page.focus('[data-role="research-notebook"] textarea'); await page.keyboard.down('Control'); await page.keyboard.press('A'); await page.keyboard.up('Control'); await page.keyboard.type(draft);
    await key('[data-note="download"]'); assert.equal(await readDownload('t-rexx-research-note-draft.txt'), draft);
    assert.equal(await records(), baseline);
    let expected = 'dismiss', count = 0;
    const listener = async dialog => { if (dialog.type() === 'beforeunload') { count++; await dialog[expected](); } };
    page.on('dialog', listener);
    // Full document navigation (not just a hash change); cancelled warning must keep draft.
    await page.goto('about:blank', { waitUntil: 'domcontentloaded', timeout: 7000 }).catch(e => { assert.match(e.message, /ERR_ABORTED/); });
    assert.equal(count, 1); assert.equal(await page.$eval('[data-role="research-notebook"] textarea', n => n.value), draft);
    await key('[data-note="save"]'); await page.waitForFunction(() => document.querySelector('[data-note="status"]').textContent.startsWith('Notes saved'));
    const saved = await records(); assert.match(saved, /QA UNSAVED U2 NOTEBOOK/);
    await page.goto('about:blank', { waitUntil: 'domcontentloaded' }); assert.equal(count, 1);
    page.off('dialog', listener);
    return { passed: true, realDraftDownload: true, downloadDoesNotSave: true, nativeLeaveCancelRetainsDraft: true, saveRemovesLeaveWarning: true,
      nativeFilePickerVerified: false, crashRecoveryGuaranteed: false };
  }
  mark('actual-reduced-motion-navigation');
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.evaluate(() => {
    window.__qaMotion = [];
    const camera = __godsEyeView.viewer.camera;
    for (const method of ['flyTo', 'flyToBoundingSphere']) {
      const original = camera[method]; camera[method] = function (...args) {
        window.__qaMotion.push({ method, duration: (method === 'flyTo' ? args[0] : args[1])?.duration });
        return original.apply(this, args);
      };
    }
  });
  await key('[data-action="refocus"]');
  let calls = await page.evaluate(() => __qaMotion.splice(0)); assert.ok(calls.length && calls.every(c => c.duration === 0), JSON.stringify(calls));
  await key('[data-action="event-sky"]');
  calls = await page.evaluate(() => __qaMotion.splice(0)); assert.ok(calls.length && calls.every(c => c.duration === 0), JSON.stringify(calls));
  await key('[data-action="full-chart"]');
  await key('[data-action="create-tour"]'); const before = await page.evaluate(() => localStorage.getItem('godsEyeView.sceneProject.v2'));
  await page.focus('[data-action="preview-tour"]'); await page.keyboard.press('Enter');
  await page.waitForFunction(() => __godsEyeView.sceneDirector.running && document.querySelector('#scene-status').textContent.includes('Reduced motion'));
  const status = await ax('#scene-announcement');
  assert.equal(status[0].role.value, 'status'); assert.equal(status[0].properties.find(p => p.name === 'live')?.value.value, 'polite');
  calls = await page.evaluate(() => __qaMotion.splice(0)); assert.ok(calls.length && calls.every(c => c.duration === 0), JSON.stringify(calls));
  await page.keyboard.press('Escape'); await page.waitForFunction(() => !__godsEyeView.sceneDirector.running && !__godsEyeView.astroEyeWorkspace.isBusy());
  assert.equal(await page.evaluate(() => document.activeElement.dataset.action), 'preview-tour');
  assert.equal(await page.evaluate(() => localStorage.getItem('godsEyeView.sceneProject.v2')), before);
  assert.equal(await records(), baseline);
  return { passed: true, browserReducedMotionEmulation: true, realVenueSkyAndDirectorZeroDuration: true, directorEscapeAndFocus: true,
    statusExposed: true, screenReaderSpeechVerified: false, savedProjectAndRecordsPreserved: true };
}
