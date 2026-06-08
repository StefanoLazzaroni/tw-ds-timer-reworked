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

/** Last tick processed by the timer loop (throttles canvas redraw) */
var lastChange;

/** Active interval for the main timer loop (every 2 ms) */
var timerInterval;

/** Active interval during startup / practice phase */
var startupInterval;

/** Text value of the arrival time shown on the page (e.g. "12:34:56") */
var lastArrival;

/** First canvas iteration: draw the arc from the start of the second */
var first = true;

/** True when the UI second just changed and we are waiting for hit+offset ms */
var changed = false;

/** Tribal Wars world number (used for per-world cookies) */
var worldNr = game_data.world;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

var COOKIE_EXPIRY_DAYS = 31 * 6; // ~6 months
var TIMER_TICK_MS = 2;
var CANVAS_SIZE = 160;
var CANVAS_CENTER = 75;
var CANVAS_RADIUS = 50;
/** Starting angle of the arc on the canvas (radians, ~-92°) */
var CIRCLE_REFERENCE = -1.6;
/** Conversion factor ms → radians for a full revolution (1000 ms = 628 ≈ 2π×100) */
var MS_TO_RADIANS = 628 / 100000;

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
// Main timer loop (canvas drawing + second-change detection)
// ---------------------------------------------------------------------------

function timer() {
	var arrival = $(".relative_time")[0].innerHTML;
	var now = new Date().getTime();

	// UI second changed: record the moment and update the display
	if (lastArrival != arrival && changed == false) {
		$("#second_display")[0].innerHTML = arrival.split(":")[2];
		changeMillis = now;
		changed = true;
	}

	// hit(ms) + offset(ms) elapsed since second change → reset and start new cycle
	var hitThreshold =
		Number($("#hit_input")[0].value) + Number($("#offset_input")[0].value);
	if (now - changeMillis >= hitThreshold && changed == true) {
		changed = false;
		resetTimer(arrival, false);
		return;
	}

	// Draw the arc on the canvas at most every ~5 ms to avoid overloading
	if (now - 5 > lastChange) {
		startCanvas(lastChange - millisReference, now - millisReference);
		lastChange = now;
	}
}

// ---------------------------------------------------------------------------
// Timer reset: clear canvas and restart the appropriate loop
// ---------------------------------------------------------------------------

/**
 * @param {string} arrival - Current arrival time from the page
 * @param {boolean} start - true = practice/startup phase (startupTimer), false = normal loop
 */
function resetTimer(arrival, start) {
	clearInterval(timerInterval);
	lastArrival = arrival;

	var now = new Date().getTime();
	millisReference = now;
	lastChange = now;
	first = true;

	if (start) {
		startupInterval = setInterval(startupTimer, TIMER_TICK_MS);
	} else {
		var canvas = document.getElementById("millis_canvas");
		var ctx = canvas.getContext("2d");
		ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
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
	}

	var hitThreshold =
		Number($("#hit_input")[0].value) + Number($("#offset_input")[0].value);
	if (now - changeMillis >= hitThreshold && changed == true) {
		clearInterval(startupInterval);
		resetTimer(arrival, false);
	}
}

// ---------------------------------------------------------------------------
// UI construction: canvas, Try button, hit/offset inputs, miss display
// ---------------------------------------------------------------------------

function addTimer() {
	try {
		var tableBody = $('#date_arrival').parent().parent()[0];
		var lastRow = tableBody.children[tableBody.children.length - 1];
		var cookieNames = [worldNr + '_hitMs', worldNr + '_offsetMs'];

		// Widen the first header cell to make room for the new columns
		tableBody.children[0].children[0].setAttribute(
			'colspan',
			Number($('[colspan]', tableBody).attr('colspan')[0]) + 4
		);

		// --- Circular canvas + current second number ---
		var canvasTd = createElement('TD', {
			rowspan: tableBody.children.length - 2,
			colspan: 4
		});
		var canvas = createElement('CANVAS', {
			id: 'millis_canvas',
			style: 'height:150px;width:150px'
		});
		var secondDisplay = createElement('H2', {
			id: 'second_display',
			style: 'position:relative;bottom:105px;left:62px'
		});
		canvasTd.appendChild(canvas);
		canvasTd.appendChild(secondDisplay);

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
		$('.village_anchor').parent().parent()[0].appendChild(canvasTd);
		lastRow.appendChild(pbTd);
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
// Drawing: arc on the canvas representing elapsed time within the second
// ---------------------------------------------------------------------------

function startCanvas(lastMillis, currentMillis) {
	var canvas = document.getElementById("millis_canvas");
	var ctx = canvas.getContext("2d");

	if (first) {
		first = false;
		lastMillis = 0;
	}

	ctx.beginPath();
	ctx.arc(
		CANVAS_CENTER,
		CANVAS_CENTER,
		CANVAS_RADIUS,
		CIRCLE_REFERENCE + lastMillis * MS_TO_RADIANS,
		CIRCLE_REFERENCE + currentMillis * MS_TO_RADIANS
	);
	ctx.stroke();
}

// ---------------------------------------------------------------------------
// Per-world settings persistence (cookies)
// ---------------------------------------------------------------------------

function setCookies() {
	var expiry = new Date();
	expiry.setTime(expiry.getTime() + COOKIE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
	var expires = 'expires=' + expiry.toUTCString();

	var names = [worldNr + '_hitMs', worldNr + '_offsetMs'];
	var values = [$("#hit_input")[0].value, $("#offset_input")[0].value];

	document.cookie = names[0] + '=' + values[0] + ';' + expires + ';';
	document.cookie = names[1] + '=' + values[1] + ';' + expires + ';';
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
