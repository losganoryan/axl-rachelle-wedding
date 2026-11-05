/**
 * RSVP collector for the Axl & Rachelle wedding and Kyle Quenzo christening invitations.
 *
 * Setup (once): see rsvp/README.md. In short: paste this into Extensions > Apps Script of a new
 * Google Sheet, run `setup`, then Deploy > New deployment > Web app (execute as Me, access Anyone)
 * and put the web app URL into rsvp-config.js.
 *
 * Each RSVP is one row in the "Responses" sheet. A name can reply only once per event: a second
 * reply under the same name is rejected as a duplicate, unless it carries the private token that
 * was handed to the device which sent the first reply. That lets a guest change their own answer
 * while the "Summary" sheet never double counts.
 */

var RESPONSES = 'Responses';
var SUMMARY = 'Summary';
var HEADERS = ['Submitted', 'Updated', 'Event', 'Name', 'Attending', 'Companions', 'Companion names', 'Seats', 'Phone', 'Message', 'Token'];
var EVENTS = ['wedding', 'christening'];
var MAX_COMPANIONS = 20;

/** Run this once from the editor to create the sheets, headers and summary formulas. */
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ensureResponses_(ss);
  var sum = ss.getSheetByName(SUMMARY) || ss.insertSheet(SUMMARY);
  sum.clear();
  var rows = [['Event', 'Responses', 'Attending', 'Declined', 'Seats to reserve']];
  EVENTS.forEach(function (ev, i) {
    var r = i + 2;
    rows.push([
      ev,
      '=COUNTIF(' + RESPONSES + '!$C:$C,A' + r + ')',
      '=COUNTIFS(' + RESPONSES + '!$C:$C,A' + r + ',' + RESPONSES + '!$E:$E,"Yes")',
      '=COUNTIFS(' + RESPONSES + '!$C:$C,A' + r + ',' + RESPONSES + '!$E:$E,"No")',
      '=SUMIF(' + RESPONSES + '!$C:$C,A' + r + ',' + RESPONSES + '!$H:$H)'
    ]);
  });
  var last = EVENTS.length + 1;
  rows.push(['Total', '=SUM(B2:B' + last + ')', '=SUM(C2:C' + last + ')', '=SUM(D2:D' + last + ')', '=SUM(E2:E' + last + ')']);
  sum.getRange(1, 1, rows.length, 5).setValues(rows);
  sum.getRange(1, 1, 1, 5).setFontWeight('bold');
  sum.getRange(rows.length, 1, 1, 5).setFontWeight('bold');
  sum.setColumnWidths(1, 5, 150);
  ss.setActiveSheet(sum);
  Logger.log('Setup complete. Sheets "' + RESPONSES + '" and "' + SUMMARY + '" are ready.');
}

/** Guests post JSON here from the invitation page. */
function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    var d = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var name = clean_(d.name, 80);
    if (!name) return json_({ ok: false, error: 'Please tell us your name.' });
    var event = EVENTS.indexOf(d.event) >= 0 ? d.event : EVENTS[0];
    var attending = d.attending === 'yes' ? 'Yes' : 'No';
    var companions = (Array.isArray(d.companions) ? d.companions : [])
      .map(function (s) { return clean_(s, 80); })
      .filter(function (s) { return s; })
      .slice(0, MAX_COMPANIONS);
    var count = Math.max(0, Math.min(MAX_COMPANIONS, parseInt(d.count, 10) || 0));
    count = Math.max(count, companions.length);
    if (attending === 'No') { count = 0; companions = []; }
    var seats = attending === 'Yes' ? 1 + count : 0;

    lock.waitLock(10000);
    var sh = ensureResponses_(SpreadsheetApp.getActiveSpreadsheet());
    var data = sh.getDataRange().getValues();
    var key = keyOf_(event, name), row = -1;
    for (var i = 1; i < data.length; i++) {
      if (keyOf_(String(data[i][2]), String(data[i][3])) === key) { row = i + 1; break; }
    }
    var token = row > 0 ? String(data[row - 1][10] || '') : Utilities.getUuid();
    if (row > 0 && (!token || clean_(d.token, 64) !== token)) {
      return json_({ ok: false, code: 'duplicate', error: 'A reply under this name was already sent.' });
    }
    var now = new Date();
    var values = [row > 0 ? data[row - 1][0] : now, now, event, name, attending, count, companions.join(', '), seats, clean_(d.phone, 40), clean_(d.message, 500), token];
    if (row > 0) sh.getRange(row, 1, 1, values.length).setValues([values]);
    else sh.appendRow(values);
    return json_({ ok: true, name: name, attending: attending, seats: seats, updated: row > 0, token: token });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  } finally {
    try { lock.releaseLock(); } catch (ignored) {}
  }
}

/** Health check, so the host can open the web app URL in a browser and see it respond. */
function doGet() {
  return json_({ ok: true, service: 'rsvp' });
}

function ensureResponses_(ss) {
  var sh = ss.getSheetByName(RESPONSES);
  if (!sh) sh = ss.insertSheet(RESPONSES, 0);
  if (sh.getLastRow() === 0) {
    sh.appendRow(HEADERS);
    sh.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
    sh.setFrozenRows(1);
    sh.getRange('A:B').setNumberFormat('yyyy-mm-dd hh:mm');
    sh.getRange('I:I').setNumberFormat('@');  // keep leading zeros in phone numbers
    sh.setColumnWidths(1, HEADERS.length, 140);
    sh.hideColumns(HEADERS.length);           // the Token column is bookkeeping, not for reading
  }
  return sh;
}

function keyOf_(event, name) {
  return event + '|' + name.toLowerCase().replace(/\s+/g, ' ').trim();
}

function clean_(v, max) {
  return String(v == null ? '' : v).replace(/[\u0000-\u001f]+/g, ' ').trim().slice(0, max);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
