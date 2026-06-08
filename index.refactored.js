/**
 * DS Timer — millisecond timing assist for Tribal Wars.
 *
 * Run from the browser console on the rally point screen.
 * During command submission it adds a visual assist to hit the desired millisecond;
 * after submission it shows how many milliseconds you missed the target by.
 */

// ---------------------------------------------------------------------------
// Global timer state
// ---------------------------------------------------------------------------

/** Reference timestamp (start of the current second shown on the page) */
var millisReference;

/** When the displayed second last changed */
var changeMillis;

/** Active timeout for restoring widget background after a flash */
var flashTimeout;

/** Active interval for the main timer loop (every 2 ms) */
var timerInterval;

/** Active interval during startup / practice phase */
var startupInterval;

/** Text value of the arrival time shown on the page (e.g. "12:34:56") */
var lastArrival;

/** True when the UI second just changed and we are waiting for hit+offset ms */
var changed = false;

/** Tribal Wars world number (used for per-world cookies) */
var worldNr = game_data.world;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

var COOKIE_EXPIRY_DAYS = 31 * 6; // ~6 months
var TIMER_TICK_MS = 2;
var FLASH_DURATION_MS = 150;
var WIDGET_DEFAULT_BG = 'transparent';

// ---------------------------------------------------------------------------
// Startup: context checks and overlay
// ---------------------------------------------------------------------------

if (game_data.screen != 'place') {
	alert(
		"This script must be run from the rally point.\n" +
		"Running during command execution will add millisecond assist.\n" +
		"Running after command execution will show you by how many milliseconds you missed the target."
	);
} else if (window.location.href.split('try=').length == 2) {
	// URL with try= param → active assist mode (injects UI and starts timer)
	addTimer();
} else {
	// After command submission: show the error saved in localStorage
	if (localStorage.missMillis != undefined) {
		alert(localStorage.missMillis);
	}
}

// Full-screen transparent overlay (does not intercept clicks)
$("#ds_body").before(
	'<div style="position: absolute; z-index: 50; width: ' +
		window.innerWidth +
		'px; height:' +
		window.innerHeight +
		'px;pointer-events: none"></div>'
);

// ---------------------------------------------------------------------------
// Main timer loop (second-change detection + flash feedback)
// ---------------------------------------------------------------------------

function timer() {
	var arrival = $(".relative_time")[0].innerHTML;
	var now = new Date().getTime();

	// UI second changed: record the moment and update the display
	if (lastArrival != arrival && changed == false) {
		$("#second_display")[0].innerHTML = arrival.split(":")[2];
		changeMillis = now;
		changed = true;
		flashOnSecondChange(arrival);
	}

	// hit(ms) + offset(ms) elapsed since second change → reset and start new cycle
	var hitThreshold =
		Number($("#hit_input")[0].value) + Number($("#offset_input")[0].value);
	if (now - changeMillis >= hitThreshold && changed == true) {
		if (parseRemainingSeconds(arrival) === 0) {
			flashWidget('green');
		}
		changed = false;
		resetTimer(arrival, false);
		return;
	}
}

// ---------------------------------------------------------------------------
// Timer reset: restore widget and restart the appropriate loop
// ---------------------------------------------------------------------------

/**
 * @param {string} arrival - Current arrival time from the page
 * @param {boolean} start - true = practice/startup phase (startupTimer), false = normal loop
 */
function resetTimer(arrival, start) {
	clearInterval(timerInterval);
	lastArrival = arrival;

	millisReference = new Date().getTime();
	resetWidgetBackground();

	if (start) {
		startupInterval = setInterval(startupTimer, TIMER_TICK_MS);
	} else {
		timerInterval = setInterval(timer, TIMER_TICK_MS);
	}
}

// ---------------------------------------------------------------------------
// Startup/practice loop: wait for second change before switching to full timer
// ---------------------------------------------------------------------------

function startupTimer() {
	var arrival = $(".relative_time")[0].innerHTML;
	var now = new Date().getTime();

	if (lastArrival != arrival && changed == false) {
		changed = true;
		$("#second_display")[0].innerHTML = arrival.split(":")[2];
		changeMillis = now;
		flashOnSecondChange(arrival);
	}

	var hitThreshold =
		Number($("#hit_input")[0].value) + Number($("#offset_input")[0].value);
	if (now - changeMillis >= hitThreshold && changed == true) {
		clearInterval(startupInterval);
		resetTimer(arrival, false);
	}
}

// ---------------------------------------------------------------------------
// UI construction: flash widget, Try button, hit/offset inputs, miss display
// ---------------------------------------------------------------------------

function addTimer() {
	try {
		var tableBody = $('#date_arrival').parent().parent()[0];
		var lastRow = tableBody.children[tableBody.children.length - 1];
		var cookieNames = [worldNr + '_hitMs', worldNr + '_offsetMs', worldNr + '_targetArrival'];

		// Widen the first header cell to make room for the new columns
		tableBody.children[0].children[0].setAttribute(
			'colspan',
			Number($('[colspan]', tableBody).attr('colspan')[0]) + 5
		);

		// --- Flash widget + current second number ---
		var widgetTd = createElement('TD', {
			rowspan: tableBody.children.length - 2,
			colspan: 4
		});
		var widget = createElement('DIV', {
			id: 'millis_widget',
			style: 'position:relative;height:150px;width:150px;background-color:transparent'
		});
		var secondDisplay = createElement('H2', {
			id: 'second_display',
			style: 'position:relative;bottom:105px;left:62px'
		});
		widgetTd.appendChild(widget);
		widgetTd.appendChild(secondDisplay);

		// --- Try / Reset button to simulate submission ---
		var practiceButton = createElement('BUTTON', {
			type: 'button',
			value: 'Try',
			id: 'practice_button',
			class: 'btn btn-recruit',
			style: 'width:80px;',
			onclick: 'practiceFunction()'
		});
		practiceButton.innerHTML = 'Try';
		var pbTd = createElement('TD', { style: 'width:60px' });
		pbTd.appendChild(practiceButton);

		// --- Input: target arrival time (HH:MM:SS) ---
		var targetDefault = getCookie(cookieNames[2]) || '';
		var targetInput = createElement('INPUT', {
			type: 'text',
			id: 'target_arrival_input',
			title: 'Target arrival time (HH:MM:SS)',
			value: targetDefault,
			placeholder: '19:33:11',
			onchange: 'setCookies()',
			style: 'width:55px'
		});
		var targetTd = createElement('TD', { style: 'width:130px' });
		targetTd.appendChild(document.createTextNode('Arrival:'));
		targetTd.appendChild(targetInput);

		// --- Input: target millisecond within the second ---
		var hitDefault = getCookie(cookieNames[0]) || 0;
		var hitInput = createElement('INPUT', {
			type: 'text',
			id: 'hit_input',
			title: 'Millisecond to hit',
			value: hitDefault,
			onchange: 'setCookies()',
			style: 'width:30px'
		});
		var hitTd = createElement('TD', { style: 'width:106px' });
		hitTd.appendChild(document.createTextNode('Hit(ms):'));
		hitTd.appendChild(hitInput);

		// --- Input: offset to compensate lag and sync with TW server time ---
		var offsetDefault = getCookie(cookieNames[1]) || 0;
		var offsetInput = createElement('INPUT', {
			type: 'text',
			id: 'offset_input',
			title: 'Remove lag and synchronize local time with TW-time',
			value: offsetDefault,
			onchange: 'setCookies()',
			style: 'width:30px'
		});
		var offsetTd = createElement('TD', { style: 'width:106px' });
		offsetTd.appendChild(document.createTextNode('Offset:'));
		offsetTd.appendChild(offsetInput);

		// --- Miss display in milliseconds (+ early / - late) ---
		var missSpan = createElement('SPAN', { id: 'miss_display' });
		missSpan.innerHTML = '0';
		var missTd = createElement('TD', { style: 'width:35px' });
		missTd.appendChild(missSpan);

		// Insert into the rally point table DOM
		$('.village_anchor').parent().parent()[0].appendChild(widgetTd);
		lastRow.appendChild(pbTd);
		lastRow.appendChild(targetTd);
		lastRow.appendChild(hitTd);
		lastRow.appendChild(offsetTd);
		lastRow.appendChild(missTd);

		// Form submit simulates a Try click
		$('#ds_body')[0].setAttribute('onsubmit', 'practiceFunction()');

		resetTimer($(".relative_time")[0].innerHTML, true);
	} catch (err) {
		console.log('Cound not find table...\n' + err);
	}
}

// ---------------------------------------------------------------------------
// Practice: simulate command submission and compute how far off the target you were
// ---------------------------------------------------------------------------

function practiceFunction() {
	var now = new Date().getTime();
	var button = $('#practice_button')[0];
	var isTryMode = button.innerHTML == 'Try';

	if (isTryMode) {
		// "Try" → stop the timer and compute error vs. target millisecond
		clearInterval(timerInterval);
		button.innerHTML = 'Reset';

		var elapsed = now - millisReference;
		var missMillis;

		if (elapsed > 500) {
			// Past half a second: treated as a hit in the following second
			missMillis = '-' + String(1000 - elapsed);
		} else {
			// Within the first half second: early relative to the start of the second
			missMillis = '+' + String(elapsed);
		}

		localStorage.missMillis = missMillis;
		$("#miss_display")[0].innerHTML = missMillis;
	} else {
		// "Reset" → restart the simulation
		button.innerHTML = 'Try';
		resetTimer($(".relative_time")[0].innerHTML, true);
	}
}

// ---------------------------------------------------------------------------
// Flash widget: background color feedback by seconds remaining
// ---------------------------------------------------------------------------

/**
 * @param {string} currentArrival - Current time from .relative_time (HH:MM:SS)
 * @returns {number} Seconds remaining until target arrival, or -1 if target not set
 */
function parseRemainingSeconds(currentArrival) {
	var targetStr = $("#target_arrival_input")[0].value.trim();
	if (!targetStr) {
		return -1;
	}

	var targetParts = targetStr.split(":");
	var currentParts = currentArrival.split(":");

	if (targetParts.length < 3 || currentParts.length < 3) {
		return -1;
	}

	var targetSec =
		Number(targetParts[0]) * 3600 +
		Number(targetParts[1]) * 60 +
		Number(targetParts[2]);
	var currentSec =
		Number(currentParts[0]) * 3600 +
		Number(currentParts[1]) * 60 +
		Number(currentParts[2]);

	return targetSec - currentSec;
}

/** Flash red/orange on second change based on seconds until target arrival */
function flashOnSecondChange(arrival) {
	var remaining = parseRemainingSeconds(arrival);
	if (remaining >= 10) {
		flashWidget('red');
	} else if (remaining >= 1) {
		flashWidget('orange');
	}
}

/** @param {string} color - CSS color for the flash */
function flashWidget(color) {
	var widget = document.getElementById("millis_widget");
	if (!widget) {
		return;
	}
	if (flashTimeout) {
		clearTimeout(flashTimeout);
		flashTimeout = null;
	}
	widget.style.backgroundColor = color;
	flashTimeout = setTimeout(function() {
		widget.style.backgroundColor = WIDGET_DEFAULT_BG;
		flashTimeout = null;
	}, FLASH_DURATION_MS);
}

function resetWidgetBackground() {
	var widget = document.getElementById("millis_widget");
	if (!widget) {
		return;
	}
	if (flashTimeout) {
		clearTimeout(flashTimeout);
		flashTimeout = null;
	}
	widget.style.backgroundColor = WIDGET_DEFAULT_BG;
}

// ---------------------------------------------------------------------------
// Per-world settings persistence (cookies)
// ---------------------------------------------------------------------------

function setCookies() {
	var expiry = new Date();
	expiry.setTime(expiry.getTime() + COOKIE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
	var expires = 'expires=' + expiry.toUTCString();

	var names = [worldNr + '_hitMs', worldNr + '_offsetMs', worldNr + '_targetArrival'];
	var values = [
		$("#hit_input")[0].value,
		$("#offset_input")[0].value,
		$("#target_arrival_input")[0].value
	];

	document.cookie = names[0] + '=' + values[0] + ';' + expires + ';';
	document.cookie = names[1] + '=' + values[1] + ';' + expires + ';';
	document.cookie = names[2] + '=' + values[2] + ';' + expires + ';';
}

function getCookie(name) {
	var prefix = name + "=";
	var cookies = document.cookie.split(';');

	for (var i = 0; i < cookies.length; i++) {
		var cookie = cookies[i];
		while (cookie.charAt(0) == ' ') {
			cookie = cookie.substring(1);
		}
		if (cookie.indexOf(prefix) === 0) {
			return cookie.substring(prefix.length, cookie.length);
		}
	}
	return "";
}

// ---------------------------------------------------------------------------
// DOM helper (reduces verbosity when creating elements with attributes)
// ---------------------------------------------------------------------------

function createElement(tag, attributes) {
	var el = document.createElement(tag);
	for (var key in attributes) {
		if (attributes.hasOwnProperty(key)) {
			el.setAttribute(key, attributes[key]);
		}
	}
	return el;
}
