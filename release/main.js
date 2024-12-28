var svg = document.querySelector('#svg-canv');
//var svgWorker = new Worker('inline-svg.js');
var fpsTarget = 60;
var floatRnd = 3;
var camera = {
	rho: 7,
	theta: 2.87,
	phi: 1.2,
	focd: 7,
};
var cameraScrollOrigin = {
	x: 0,
	y: 0,
	theta: camera.theta,
	phi: camera.phi,
};

window.addEventListener('mousedown',
	event => {
		if (event.button == 0) {
			cameraScrollOrigin = {
				x: event.pageX,
				y: event.pageY,
				theta: camera.theta,
				phi: camera.phi,
			};
		}
	},
	{passive: false},
);

window.addEventListener('touchstart',
	event => {
		event.preventDefault();
		cameraScrollOrigin = {
			x: event.pageX,
			y: event.pageY,
			theta: camera.theta,
			phi: camera.phi,
		};
	},
	{passive: false},
);

window.addEventListener('mousemove',
	event => {
		if (event.buttons == 1) {
			let deltaX = event.pageX - cameraScrollOrigin.x;
			let deltaY = event.pageY - cameraScrollOrigin.y;
			document.querySelector('#mouse').innerText = `${deltaX} ${deltaY}`;
			camera.theta = cameraScrollOrigin.theta + 2*Math.PI*deltaX/window.innerWidth;
			camera.phi = cameraScrollOrigin.phi - 2*Math.PI*deltaY/window.innerHeight;
		}
	},
	{passive: false},
);

window.addEventListener('touchmove',
	event => {
		event.preventDefault();
		let deltaX = event.pageX - cameraScrollOrigin.x;
		let deltaY = event.pageY - cameraScrollOrigin.y;
		document.querySelector('#mouse').innerText = `${deltaX} ${deltaY}`;
		camera.theta = cameraScrollOrigin.theta + 2*Math.PI*deltaX/window.innerWidth;
		camera.phi = cameraScrollOrigin.phi - 2*Math.PI*deltaY/window.innerHeight;
	},
	{passive: false},
);

function MoveTo(p) {
	return `M${p.x.toFixed(floatRnd)} ${-p.y.toFixed(floatRnd)}`;
}

function LineTo(p) {
	return `L${p.x.toFixed(floatRnd)} ${-p.y.toFixed(floatRnd)}`;
}

function ClosePath() {
	return `Z`;
}

function QuadTo(crlp, p) {
	return `Q${crlp.x.toFixed(floatRnd)} ${-crlp.y.toFixed(floatRnd)} ${p.x.toFixed(floatRnd)} ${-p.y.toFixed(floatRnd)}`;
}

function projectPt(p) {
	let st = Math.sin(camera.theta);
	let ct = Math.cos(camera.theta);
	let sp = Math.sin(camera.phi);
	let cp = Math.cos(camera.phi);
	let denom = (camera.rho + camera.focd - p.z*cp - (p.x*ct + p.y*st)*sp)/camera.focd;
	return {
		x: (p.y*ct - p.x*st)/denom,
		y: (p.z*sp - (p.x*ct + p.y*st)*cp)/denom,
	};
}

function PolyLineFromParametric2D(f, t0, t1) {
	let quadrance = (p0, p1) => (p0.x - p1.x)**2 + (p0.y - p1.y)**2;
	const quadrTarget = 1;
	const dt = 1;
	let paramT = [t0];
	for (let p = f(t0); quadrance(p, f(t1)) > quadrTarget;) {
		let t = paramT.at(-1) + dt;
		let q = quadrance(p, f(t));
		for (let i = 1; q > quadrTarget; i++) {
			t = paramT.at(-1) + dt/(2**i);
			q = quadrance(p, f(t));
		}
		p = f(t);
		paramT.push(t);
	}
	paramT.push(t1);
	let svgPath = ['<path d="'];
	let p = f(t0);
	svgPath.push(MoveTo(p));
	for (let i = 1; i < paramT.length; i++) {
		p = f(paramT.at(i));
		svgPath.push(LineTo(p));
	}
	svgPath.push('"></path>');
	return svgPath.join('');
}

function Diamond(r, c) {
	let corners = [
		{x: c.x, y: c.y - r},
		{x: c.x + r, y: c.y},
		{x: c.x, y: c.y + r},
		{x: c.x - r, y: c.y},
	];
	return '<path d="'
	+ MoveTo(corners[0])
	+ LineTo(corners[1])
	+ LineTo(corners[2])
	+ LineTo(corners[3])
	+ ClosePath()
	+ '"></path>';
}

function Tetrahedron(r) {
	let l = r/2/Math.sqrt(2);
	let corners = [
		{x: l, y: l, z: l},
		{x: l, y: -l, z: -l},
		{x: -l, y: l, z: -l},
		{x: -l, y: -l, z: l},
	].map(projectPt);
	return '<path d="'
	+ MoveTo(corners[0])
	+ LineTo(corners[1])
	+ LineTo(corners[2])
	+ LineTo(corners[0])
	+ LineTo(corners[3])
	+ LineTo(corners[1])
	+ MoveTo(corners[0])
	+ LineTo(corners[3])
	+ LineTo(corners[2])
	+ '"></path>';
}

var gameState = {
	pos: {x: 0, y: 0},
	vel: {x: 1, y: 0},
	acc: {x: 0, y: 1},
};

var accRenderTime = 0;
var numFrames = 0;

function update() {
	let frameStartTime = Date.now();
	const dt = 1/fpsTarget;
	if (gameState.pos.y > 9 && gameState.vel.y > 0) {
		gameState.vel.y *= -1;
	}
	if ((gameState.pos.x > 9 && gameState.vel.x > 0) || (gameState.pos.x < -9 && gameState.vel.x < 0)) {
		gameState.vel.x *= -1;
	}
	gameState.vel = {
		x: gameState.vel.x + gameState.acc.x*dt,
		y: gameState.vel.y + gameState.acc.y*dt,
	};
	gameState.pos = {
		x: gameState.pos.x + gameState.vel.x*dt,
		y: gameState.pos.y + gameState.vel.y*dt,
	};
	let shapes = [];
	shapes.push(Diamond(0.5, gameState.pos));
	let curve = t => ({
		x: 1/5*(t - 1/500)**3 - t**2 - t - 3,
		y: Math.cos(t) + t - 2,
	});
	shapes.push(PolyLineFromParametric2D(curve, -3.2, 6.3));
	shapes.push(Tetrahedron(7));
	svg.innerHTML = shapes.join('');
	let renderTime = Date.now() - frameStartTime;
	accRenderTime += renderTime;
	numFrames++;
	setTimeout(() => requestAnimationFrame(update), 1000/fpsTarget - renderTime);
}

setInterval(
	() => {
		document.querySelector('#perf').innerText = `avg render time /sec ${(accRenderTime/numFrames).toFixed(2)}ms`;
		accRenderTime = 0;
		numFrames = 0;
	},
	1000,
);
requestAnimationFrame(update);
