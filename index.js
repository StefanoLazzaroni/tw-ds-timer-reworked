var millisReference,
	changeMillis,
	lastChange,
	timerInterval,
	startupInterval,
	lastArrival,
	first = true,
	changed = false,
	worldNr = game_data.world;

if(game_data.screen != 'place'){
	alert("This script must be run from the rally point.\nRunning during command execution will add millisecond assist.\nRunning after command excecution will show you by how many milliseconds you missed the target.");
}
else if(window.location.href.split('try=').length == 2){
	addTimer();
}
else{
	if(localStorage.missMillis == undefined){}
	else{alert(localStorage.missMillis);}
}
$("#ds_body").before(`<div style="position: absolute; z-index: 50; width: `+ window.innerWidth + `px; height:`+ window.innerHeight + `px;pointer-events: none"></div>`);
function timer(){
	var arrival = $(".relative_time")[0].innerHTML,
		d = new Date(),
		now = d.getTime();
	if(lastArrival != arrival && changed == false){
		$("#second_display")[0].innerHTML = arrival.split(":")[2];
		changeMillis = now;
		changed = true;
	}
	if((now - changeMillis >= Number($("#hit_input")[0].value) + Number($("#offset_input")[0].value)) && (changed == true)){
		changed = false;
		resetTimer(arrival, false);
		return;
	}
	if(now - 5 > lastChange){
		startCanvas(lastChange - millisReference, now - millisReference);
		lastChange = now;
	}
	else{
		return;
	}
}
function resetTimer(arrival, start){
	clearInterval(timerInterval);
	lastArrival = arrival;
	var d = new Date();
	millisReference = d.getTime();
	lastChange = d.getTime();
	first = true;
	if(start){
		startupInterval = setInterval(startupTimer, 2);
	}
	else{
		var c = document.getElementById("millis_canvas"),
			ctx = c.getContext("2d");
		ctx.clearRect(0, 0, 160, 160);
		timerInterval = setInterval(timer, 2);
	}
	
}

function startupTimer(){
	var arrival = $(".relative_time")[0].innerHTML,
		d = new Date(),
		now = d.getTime();
	if(lastArrival != arrival && changed == false){
		changed = true;
		$("#second_display")[0].innerHTML = arrival.split(":")[2];
		changeMillis = now;
	}
	if((now - changeMillis >= Number($("#hit_input")[0].value) + Number($("#offset_input")[0].value)) && (changed == true)){
		clearInterval(startupInterval);
		resetTimer(arrival, false);
		return;	
	}
}

function addTimer(){
	try{
		var tableBody = $('#date_arrival').parent().parent()[0],
			lastRow = tableBody.children[tableBody.children.length-1],
			cname = [worldNr+'_hitMs', worldNr+'_offsetMs'];
		tableBody.children[0].children[0].setAttribute('colspan', Number($('[colspan]', tableBody).attr('colspan')[0])+4);
		
		//Create canvas:
		var canvasTd = document.createElement('TD'),
			canvasCanvas = document.createElement('CANVAS'),
			canvasRowspan = document.createAttribute('rowspan'),
			canvasColspan = document.createAttribute('colspan'),
			canvasId = document.createAttribute('id'),
			canvasStyle = document.createAttribute('style'),
			secondDisplay = document.createElement('H2'),
			secondStyle = document.createAttribute('style'),
			secondId = document.createAttribute('id');
		canvasRowspan.value = tableBody.children.length-2;
		canvasColspan.value = 4;
		canvasId.value = 'millis_canvas';
		canvasStyle.value = 'height:150px;width:150px'
		canvasTd.setAttributeNode(canvasRowspan);
		canvasTd.setAttributeNode(canvasColspan);
		canvasCanvas.setAttributeNode(canvasId);
		secondStyle.value = 'position:relative;bottom:105px;left:62px';
		secondId.value = 'second_display';
		secondDisplay.setAttributeNode(secondId);
		secondDisplay.setAttributeNode(secondStyle);
		canvasTd.appendChild(canvasCanvas);
        canvasTd.appendChild(secondDisplay);
        
		
		//Create practice button:
		var pbTd = document.createElement('TD'),
			pbTdStyle = document.createAttribute('style'),
			pbButton = document.createElement('BUTTON'),
			pbType = document.createAttribute('type'),
			pbValue = document.createAttribute('value'),
			pbOnclick = document.createAttribute('onclick'),
			pbId = document.createAttribute('id'),
			pbClass = document.createAttribute('class'),
			pbStyle = document.createAttribute('style');
		pbTdStyle.value = 'width:60px';
		pbTd.setAttributeNode(pbTdStyle);
		pbType.value = 'button';
		pbValue.value = 'Try';
		pbOnclick.value = 'practiceFunction()';
		pbId.value = 'practice_button';
		pbClass.value = 'btn btn-recruit';
		pbStyle.value = 'width:80px;';
		pbButton.setAttributeNode(pbType);
		pbButton.setAttributeNode(pbValue);
		pbButton.setAttributeNode(pbId);
		pbButton.setAttributeNode(pbOnclick);
		pbButton.setAttributeNode(pbClass);
		pbButton.setAttributeNode(pbStyle);
		pbButton.innerHTML = 'Try';
		pbTd.appendChild(pbButton);
		
		//Create hittime input
		var hitTd = document.createElement('TD'),
			hitText = document.createElement('SPAN'),
			hitInput = document.createElement('INPUT'),
			hitType = document.createAttribute('type'),
			hitInputStyle = document.createAttribute('style'),
			hitStyle = document.createAttribute('style'),
			hitTitle = document.createAttribute('title'),
			hitValue = document.createAttribute('value'),
			hitOnchange = document.createAttribute('onchange'),
			hitId = document.createAttribute('id');
		hitType.value = 'text';
		hitId.value = 'hit_input';
		hitTitle.value = 'Millisecond to hit';
		hitOnchange.value = 'setCookies()';
		var hitDefault = getCookie(cname[0]);
		if(hitDefault == ""){hitDefault = 0;}
		hitValue.value = hitDefault;
		hitInput.setAttributeNode(hitType);
		hitInput.setAttributeNode(hitId);
		hitInput.setAttributeNode(hitTitle);
		hitInput.setAttributeNode(hitValue);
		hitInput.setAttributeNode(hitOnchange);
		hitInputStyle.value = 'width:30px';
		hitStyle.value = 'width:106px';
		hitInput.setAttributeNode(hitInputStyle);
		hitTd.setAttributeNode(hitStyle);
		hitText.innerHTML = 'Hit(ms):';
		hitTd.appendChild(hitText);
		hitTd.appendChild(hitInput);
		
		//create offset input
		var offsetTd = document.createElement('TD'),
			offsetText = document.createElement('SPAN'),
			offsetInput = document.createElement('INPUT'),
			offsetType = document.createAttribute('type'),
			offsetInputStyle = document.createAttribute('style'),
			offsetStyle = document.createAttribute('style'),
			offsetTitle = document.createAttribute('title'),
			offsetValue = document.createAttribute('value'),
			offsetOnchange = document.createAttribute('onchange'),
			offsetId = document.createAttribute('id');
		offsetType.value = 'text';
		offsetId.value = 'offset_input';
		offsetTitle.value = 'Remove lag and synchronize local time with TW-time';
		offsetOnchange.value = 'setCookies()';
		var offsetDefault = getCookie(cname[1]);
		if(offsetDefault == ""){offsetDefault = 0;}
		offsetValue.value = offsetDefault;
		offsetInput.setAttributeNode(offsetType);
		offsetInput.setAttributeNode(offsetId);
		offsetInput.setAttributeNode(offsetTitle);
		offsetInput.setAttributeNode(offsetValue);
		offsetInput.setAttributeNode(offsetOnchange);
		offsetInputStyle.value = 'width:30px';
		offsetStyle.value = 'width:106px'
		offsetInput.setAttributeNode(offsetInputStyle);
		offsetTd.setAttributeNode(offsetStyle);
		offsetText.innerHTML = 'Offset:';
		offsetTd.appendChild(offsetText);
		offsetTd.appendChild(offsetInput);
		
		//Create misstime display:
		var missTd = document.createElement('TD'),
			missSpan = document.createElement('SPAN'),
			missStyle = document.createAttribute('style'),
			missId = document.createAttribute('id');
		missId.value = 'miss_display';
		missStyle.value = 'width:35px';
		missSpan.setAttributeNode(missId);
		missTd.setAttributeNode(missStyle);
		missSpan.innerHTML = '0';
		missTd.appendChild(missSpan);
			
			
		$('.village_anchor').parent().parent()[0].appendChild(canvasTd);
		lastRow.appendChild(pbTd);
		//lastRow.appendChild(rbTd);
		lastRow.appendChild(hitTd);
		lastRow.appendChild(offsetTd);
		lastRow.appendChild(missTd);
		$('#ds_body')[0].setAttribute('onsubmit', 'practiceFunction()');
		resetTimer($(".relative_time")[0].innerHTML, true);
	}
	catch(err){
		console.log('Cound not find table...\n'+err);
	}
}

function practiceFunction(){
	var d = new Date(),
		now = d.getTime(),
		missMillis,
		buttonText = ['Try', 'Reset'],
		buttonDOM = $('#practice_button')[0];
	
	if(buttonDOM.innerHTML == buttonText[0]){
		clearInterval(timerInterval);
		buttonDOM.innerHTML = buttonText[1];
		if(now - millisReference > 500){
			missMillis = '-'+String(1000 - (now - millisReference));
		}
		else{
			missMillis = '+'+String(now - millisReference);
		}
		localStorage.missMillis = missMillis;
		$("#miss_display")[0].innerHTML = missMillis;
	}
	else{
		buttonDOM.innerHTML = buttonText[0];
		resetTimer($(".relative_time")[0].innerHTML, true);
	}
}

function startCanvas(lastMillis, currentMillis){
	var c = document.getElementById("millis_canvas"),
		ctx = c.getContext("2d"),
		circleReference = -1.6;
	if(first){first=false;lastMillis=0;}
	ctx.beginPath();
	ctx.arc(75, 75, 50, circleReference + lastMillis/100000 * 628, circleReference + currentMillis/100000 * 628);
	ctx.stroke();
}

function setCookies(){
    var d = new Date();
    d.setTime(d.getTime() + (31*6*24*60*60*1000));
    var expires = 'expires='+ d.toUTCString();
	
	var cname = [worldNr+'_hitMs', worldNr+'_offsetMs'],
		cvalue = [$("#hit_input")[0].value, $("#offset_input")[0].value];
	
    document.cookie = cname[0]+'='+cvalue[0]+';'+expires+';';
	document.cookie = cname[1]+'='+cvalue[1]+';'+expires+';';
}

function getCookie(cname) {
    var name = cname + "=";
    var ca = document.cookie.split(';');
    for (var i = 0; i < ca.length; i++) {
        var c = ca[i];
        while (c.charAt(0) == ' ') c = c.substring(1);
        if (c.indexOf(name) === 0) {
            return c.substring(name.length, c.length);
        }
    }
    return "";
}