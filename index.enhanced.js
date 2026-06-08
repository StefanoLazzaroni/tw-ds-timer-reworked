/**
 * Tribal Wars rally-point timing helper (enhanced).
 *
 * Runs on the rally point "try attack" screen (URL contains `try=`).
 * Lets the player set a target arrival time (UTC), shows when troops must be
 * sent, and displays a live countdown synced to the game server clock.
 */

// --- Module state ---

var tickInterval,
	flashTimeout,
	lastFlashedSecond = -1,   // avoids re-flashing the same second during countdown
	hasFlashedGreen = false,  // green flash fires once at T-0
	countdownWidget,
	countdownDisplay,
	countdownDefaultBg = 'rgba(40,40,40,0.85)',
	serverClockAnchor = null, // set on each #serverTime tick: { serverSecondMs, clientMsAtTick }
	lastServerDateTimeKey = '',
	serverClockSyncPoll = null;

// --- Entry point ---

if (game_data.screen != 'place') {
	alert('This script must be run from the rally point.');
} else if (window.location.href.split('try=').length == 2) {
	addEnhancedUI();
}

// --- Date/time parsing and formatting ---

/** Parse `dd/mm/yyyy hh:mm:ss:mmm` (UTC) from the arrival input. Returns ms timestamp or null. */
function parseArrival(str) {
	var match = str.trim().match(/^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2}):(\d{2}):(\d{3})$/);
	if (!match) {
		return null;
	}
	return Date.UTC(
		Number(match[3]),
		Number(match[2]) - 1,
		Number(match[1]),
		Number(match[4]),
		Number(match[5]),
		Number(match[6]),
		Number(match[7])
	);
}

/** Format a UTC timestamp as `dd/mm/yyyy hh:mm:ss:mmm`. */
function formatDateTime(ts) {
	if (ts === null || isNaN(ts)) {
		return '—';
	}
	var d = new Date(ts),
		pad = function (n, len) {
			var s = String(n);
			while (s.length < len) {
				s = '0' + s;
			}
			return s;
		};
	return pad(d.getUTCDate(), 2) + '/' +
		pad(d.getUTCMonth() + 1, 2) + '/' +
		d.getUTCFullYear() + ' ' +
		pad(d.getUTCHours(), 2) + ':' +
		pad(d.getUTCMinutes(), 2) + ':' +
		pad(d.getUTCSeconds(), 2) + ':' +
		pad(d.getUTCMilliseconds(), 3);
}

/** Format milliseconds as `h:mm:ss` (no milliseconds). */
function formatDuration(ms) {
	if (!ms || isNaN(ms)) {
		return '—';
	}
	var totalSec = Math.floor(ms / 1000),
		h = Math.floor(totalSec / 3600),
		m = Math.floor((totalSec % 3600) / 60),
		s = totalSec % 60,
		pad = function (n) {
			return n < 10 ? '0' + n : String(n);
		};
	return h + ':' + pad(m) + ':' + pad(s);
}

// --- Server clock sync ---
// #serverTime updates once per second (hh:mm:ss only). Sub-second ms must be
// extrapolated from the client clock, anchored when the DOM second ticks — same
// idea as the common #serverMs bookmarklet that watches for #serverTime changes.

/** Composite key used to detect server second rollovers (date + time). */
function getServerDateTimeKey() {
	var dateEl = document.getElementById('serverDate'),
		timeEl = document.getElementById('serverTime');
	if (!dateEl || !timeEl) {
		return null;
	}
	return dateEl.textContent.trim() + ' ' + timeEl.textContent.trim();
}

/** Parse #serverDate + #serverTime as UTC ms; optional sub-second ms (default 0). */
function readServerClockFromDOM(ms) {
	var dateEl = document.getElementById('serverDate'),
		timeEl = document.getElementById('serverTime');
	if (!dateEl || !timeEl) {
		return null;
	}
	var dateParts = dateEl.textContent.trim().split('/'),
		timeParts = timeEl.textContent.trim().split(':');
	if (dateParts.length !== 3 || timeParts.length < 3) {
		return null;
	}
	return Date.UTC(
		Number(dateParts[2]),
		Number(dateParts[1]) - 1,
		Number(dateParts[0]),
		Number(timeParts[0]),
		Number(timeParts[1]),
		Number(timeParts[2]),
		ms !== undefined ? ms : (timeParts[3] ? Number(timeParts[3]) : 0)
	);
}

/**
 * Anchor when #serverTime rolls to a new second.
 * The displayed second always starts at .000 at the moment the DOM updates.
 */
function onServerSecondTick() {
	var serverSecondMs = readServerClockFromDOM(0);
	if (serverSecondMs === null) {
		return;
	}
	serverClockAnchor = {
		serverSecondMs: serverSecondMs,
		clientMsAtTick: Date.now()
	};
	lastServerDateTimeKey = getServerDateTimeKey();
}

/**
 * Wait for the first #serverTime tick before anchoring (poll every 20 ms).
 * Avoids syncing mid-second with ms=0, which causes up to ~1 s of ms drift.
 */
function startServerClockSync() {
	var key = getServerDateTimeKey();
	if (key === null) {
		return;
	}
	lastServerDateTimeKey = key;
	if (serverClockSyncPoll !== null) {
		clearInterval(serverClockSyncPoll);
	}
	serverClockSyncPoll = setInterval(function () {
		var currentKey = getServerDateTimeKey();
		if (currentKey === null) {
			return;
		}
		if (currentKey !== lastServerDateTimeKey) {
			onServerSecondTick();
			clearInterval(serverClockSyncPoll);
			serverClockSyncPoll = null;
		}
	}, 20);
}

/**
 * Best-effort server "now" in ms.
 * Re-anchors on every DOM second tick, then adds elapsed client time.
 */
function getServerNow() {
	var currentKey = getServerDateTimeKey();
	if (currentKey !== null && currentKey !== lastServerDateTimeKey) {
		onServerSecondTick();
	}
	if (serverClockAnchor) {
		return serverClockAnchor.serverSecondMs + (Date.now() - serverClockAnchor.clientMsAtTick);
	}
	if (typeof Timing !== 'undefined' && Timing.getCurrentServerTime) {
		return Timing.getCurrentServerTime();
	}
	var domMs = readServerClockFromDOM(0);
	if (domMs !== null) {
		return domMs;
	}
	return Date.now();
}

/** Parse #serverDate into { day, month, year } (game uses dd/mm/yyyy). */
function getServerDateParts() {
	var dateEl = document.getElementById('serverDate');
	if (!dateEl) {
		return null;
	}
	var parts = dateEl.textContent.trim().split('/');
	if (parts.length !== 3) {
		return null;
	}
	return {
		day: Number(parts[0]),
		month: Number(parts[1]),
		year: Number(parts[2])
	};
}

// --- Game arrival time extraction ---

/**
 * Parse human-readable arrival text from the rally table
 * (e.g. "tomorrow at 14:30:00", "on 12.06. at 14:30:00:123").
 */
function parseGameArrivalText(text) {
	var timeMatch = text.match(/(\d{1,2}):(\d{2}):(\d{2})(?::(\d{3}))?/);
	if (!timeMatch) {
		return null;
	}

	var serverDate = getServerDateParts(),
		day,
		month,
		year,
		dateMatch = text.match(/on\s+(\d{1,2})\.(\d{1,2})\./i);

	if (/tomorrow/i.test(text)) {
		if (!serverDate) {
			return null;
		}
		var tomorrow = new Date(Date.UTC(serverDate.year, serverDate.month - 1, serverDate.day) + 86400000);
		day = tomorrow.getUTCDate();
		month = tomorrow.getUTCMonth() + 1;
		year = tomorrow.getUTCFullYear();
	} else if (dateMatch) {
		day = Number(dateMatch[1]);
		month = Number(dateMatch[2]);
		year = serverDate ? serverDate.year : new Date(getServerNow()).getUTCFullYear();
	} else if (serverDate) {
		// Same-day arrival when no explicit date is shown
		day = serverDate.day;
		month = serverDate.month;
		year = serverDate.year;
	} else {
		return null;
	}

	return Date.UTC(
		year,
		month - 1,
		day,
		Number(timeMatch[1]),
		Number(timeMatch[2]),
		Number(timeMatch[3]),
		timeMatch[4] ? Number(timeMatch[4]) : 0
	);
}

/**
 * Resolve arrival time from #date_arrival .relative_time.
 * Prefers data-duration, then data-end/data-endtime, then visible text.
 */
function parseGameArrival() {
	var el = document.querySelector('#date_arrival .relative_time');
	if (!el) {
		return null;
	}

	var durationSec = parseInt(el.getAttribute('data-duration'), 10);
	if (!isNaN(durationSec)) {
		return getServerNow() + durationSec * 1000;
	}

	var endAttr = el.getAttribute('data-end') || el.getAttribute('data-endtime');
	if (endAttr) {
		var endTs = parseInt(endAttr, 10);
		if (!isNaN(endTs)) {
			// Game may store seconds (< 1e12) or milliseconds
			return endTs < 1e12 ? endTs * 1000 : endTs;
		}
	}

	return parseGameArrivalText((el.textContent || el.innerHTML).trim());
}

/** Default target arrival: game ETA plus 5 minutes (common snipe offset). */
function getDefaultArrivalTime() {
	var gameArrival = parseGameArrival();
	if (gameArrival === null) {
		return null;
	}
	return gameArrival + 5 * 60 * 1000;
}

// --- Troop travel duration and send time ---

/** Read march duration from data-duration or the Duration table row. */
function getDurationMs() {
	var sec = $('.relative_time').attr('data-duration');
	if (sec) {
		return parseInt(sec, 10) * 1000;
	}
	var rows = $('#date_arrival').closest('table').find('tr');
	for (var i = 0; i < rows.length; i++) {
		var cells = rows[i].children;
		if (cells.length >= 2 && cells[0].innerHTML.indexOf('Duration') !== -1) {
			var parts = cells[1].innerHTML.trim().split(':');
			if (parts.length === 3) {
				return (Number(parts[0]) * 3600 + Number(parts[1]) * 60 + Number(parts[2])) * 1000;
			}
		}
	}
	return null;
}

/** sendTime = targetArrival - marchDuration */
function getSendTime() {
	var arrivalInput = document.getElementById('arrival_input');
	if (!arrivalInput) {
		return null;
	}
	var arrivalTs = parseArrival(arrivalInput.value);
	if (arrivalTs === null) {
		return null;
	}
	var durationMs = getDurationMs();
	if (durationMs === null) {
		return null;
	}
	return arrivalTs - durationMs;
}

/** Refresh Send and Duration labels whenever the arrival input changes. */
function updateSendTimeDisplay() {
	var sendDisplay = document.getElementById('send_display');
	var durationDisplay = document.getElementById('duration_display');
	if (!sendDisplay) {
		return;
	}
	var durationMs = getDurationMs();
	if (durationDisplay) {
		durationDisplay.innerHTML = durationMs !== null ? formatDuration(durationMs) : '—';
	}
	sendDisplay.innerHTML = formatDateTime(getSendTime());
}

// --- Countdown display ---

function padFixed(n, len) {
	var str = String(Math.floor(n));
	if (str.length > len) {
		return str.slice(0, len);
	}
	while (str.length < len) {
		str = '0' + str;
	}
	return str;
}

/** Format remaining ms as `hh:mm:ss:mmm`; prefix `+` when late. */
function formatCountdown(diffMs) {
	if (diffMs === null || isNaN(diffMs)) {
		return '—';
	}
	var late = diffMs < 0,
		abs = Math.floor(Math.abs(diffMs)),
		h = Math.floor(abs / 3600000),
		m = Math.floor((abs % 3600000) / 60000),
		s = Math.floor((abs % 60000) / 1000),
		ms = abs % 1000,
		text = padFixed(h, 2) + ':' + padFixed(m, 2) + ':' + padFixed(s, 2) + ':' + padFixed(ms, 3);
	return late ? '+' + text : text;
}

/** Insert the countdown bar above the enhanced input row. */
function createCountdownWidget(tableBody, insertBefore) {
	var countdownRow = document.createElement('TR'),
		countdownTd = document.createElement('TD');

	countdownTd.colSpan = 6;
	countdownTd.style.padding = '6px 0';

	countdownWidget = document.createElement('div');
	countdownWidget.id = 'ds_countdown_widget';
	countdownWidget.style.cssText =
		'padding:10px 14px;background:' + countdownDefaultBg + ';' +
		'border:2px solid rgba(255,255,255,0.25);border-radius:4px;' +
		'text-align:center;font-family:monospace;font-size:24px;font-weight:bold;' +
		'color:#fff;line-height:1.2;transition:background-color 50ms linear;';

	countdownDisplay = document.createElement('div');
	countdownDisplay.id = 'ds_countdown_display';
	countdownDisplay.style.cssText =
		'display:inline-block;min-width:14ch;font-variant-numeric:tabular-nums;letter-spacing:0.05em;';
	countdownDisplay.innerHTML = '00:00:00:000';
	countdownWidget.appendChild(countdownDisplay);
	countdownTd.appendChild(countdownWidget);
	countdownRow.appendChild(countdownTd);
	tableBody.insertBefore(countdownRow, insertBefore);
}

/** Brief background color pulse on the countdown widget. */
function flash(color) {
	if (!countdownWidget) {
		return;
	}
	countdownWidget.style.background = color;
	clearTimeout(flashTimeout);
	flashTimeout = setTimeout(function () {
		countdownWidget.style.background = countdownDefaultBg;
	}, 150);
}

/**
 * Main loop (every 15 ms for smooth millisecond display).
 *
 * Flash colors:
 *   green  — within ±50 ms of send time (once)
 *   blue   — late (past send time)
 *   red    — more than 9 seconds remaining (once per second)
 *   orange — final 9 seconds down to 50 ms before send
 */
function tick() {
	updateSendTimeDisplay();

	var sendTime = getSendTime();
	if (sendTime === null) {
		lastFlashedSecond = -1;
		hasFlashedGreen = false;
		if (countdownDisplay) {
			countdownDisplay.innerHTML = '—';
		}
		return;
	}

	var now = getServerNow(),
		diff = sendTime - now,
		secRemaining = Math.floor(diff / 1000);

	if (countdownDisplay) {
		countdownDisplay.innerHTML = formatCountdown(diff);
	}

	if (Math.abs(diff) < 50) {
		if (!hasFlashedGreen) {
			flash('rgba(0,255,0,0.35)');
			hasFlashedGreen = true;
		}
		return;
	}

	hasFlashedGreen = false;

	if (diff < -50) {
		if (lastFlashedSecond !== secRemaining) {
			flash('rgba(0,0,255,0.35)');
			lastFlashedSecond = secRemaining;
		}
		return;
	}

	if (secRemaining > 9) {
		if (lastFlashedSecond !== secRemaining) {
			flash('rgba(255,0,0,0.35)');
			lastFlashedSecond = secRemaining;
		}
	} else if (diff >= 50) {
		if (lastFlashedSecond !== secRemaining) {
			flash('rgba(255,165,0,0.35)');
			lastFlashedSecond = secRemaining;
		}
	}
}

// --- UI bootstrap ---

/** Build arrival input, send/duration readouts, countdown, and start the tick loop. */
function addEnhancedUI() {
	try {
		var tableBody = $('#date_arrival').parent().parent()[0],
			enhancedRow = document.createElement('TR');

		var arrivalTd = document.createElement('TD'),
			arrivalLabel = document.createElement('SPAN'),
			arrivalInput = document.createElement('INPUT');
		arrivalLabel.innerHTML = 'Arrival: ';
		arrivalInput.type = 'text';
		arrivalInput.id = 'arrival_input';
		arrivalInput.placeholder = 'dd/mm/yyyy hh:mm:ss:mmm UTC';
		arrivalInput.title = 'Target arrival time (UTC / London)';
		arrivalInput.style.width = '180px';
		arrivalInput.addEventListener('input', function () {
			lastFlashedSecond = -1;
			hasFlashedGreen = false;
			updateSendTimeDisplay();
		});
		arrivalTd.colSpan = 2;
		arrivalTd.appendChild(arrivalLabel);
		arrivalTd.appendChild(arrivalInput);

		var defaultArrival = getDefaultArrivalTime();
		if (defaultArrival !== null) {
			arrivalInput.value = formatDateTime(defaultArrival);
		}

		var sendTd = document.createElement('TD'),
			sendLabel = document.createElement('SPAN'),
			sendDisplay = document.createElement('SPAN');
		sendLabel.innerHTML = 'Send: ';
		sendDisplay.id = 'send_display';
		sendDisplay.innerHTML = '—';
		sendTd.colSpan = 2;
		sendTd.appendChild(sendLabel);
		sendTd.appendChild(sendDisplay);

		var durationTd = document.createElement('TD'),
			durationLabel = document.createElement('SPAN'),
			durationDisplay = document.createElement('SPAN');
		durationLabel.innerHTML = 'Duration: ';
		durationDisplay.id = 'duration_display';
		durationDisplay.innerHTML = '—';
		durationTd.colSpan = 2;
		durationTd.appendChild(durationLabel);
		durationTd.appendChild(durationDisplay);

		enhancedRow.appendChild(arrivalTd);
		enhancedRow.appendChild(sendTd);
		enhancedRow.appendChild(durationTd);
		tableBody.appendChild(enhancedRow);

		startServerClockSync();
		createCountdownWidget(tableBody, enhancedRow);
		updateSendTimeDisplay();
		tickInterval = setInterval(tick, 15);
	} catch (err) {
		console.log('Could not find table...\n' + err);
	}
}
