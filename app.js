"use strict";

const PI = 3.14159265359;
const PI2 = PI/2;
const PI3 = 3*PI/2;
const DR = 0.0174533	// 1 degree in radians
const FOV = 35;
const MAXDOF = 20;	// max depth of field

const BLOCKSIZE = 64;
const BLOCKDIV = 4;

const Color = core2d.Color;
const Command = core2d.Command;
const TextSprite = core2d.TextSprite;
const Core2D = core2d.Core2D;

const MAP = [
	1,1,1,1,1,1,1,1,1,1,
	1,0,0,0,0,0,0,0,0,1,
	1,0,1,1,0,0,0,0,0,1,
	1,0,0,0,1,0,0,0,0,1,
	1,0,1,0,1,0,0,1,0,1,
	1,0,0,0,0,0,0,0,0,1,
	1,0,0,0,0,0,0,0,0,1,
	1,0,0,1,1,1,0,0,0,1,
	1,0,0,0,0,0,0,0,0,1,
	1,1,1,1,1,1,1,0,1,1,
];
const MAPW = 10;
const MAPH = 10;

function degToRad(a) { 	return a*PI/180.0; }
function fixAng(a) { if(a>359) { a-=360; }	if(a<0) { a+=360; }	return a; }
function distance(ax, ay, bx, by, ang) { return Math.cos(degToRad(ang))*(bx-ax)-Math.sin(degToRad(ang))*(by-ay); }

function lightenDarkenColor(color, amount) {
	color = color.slice(1);
	var num = parseInt(color,16);
	var r = (num >> 16) + amount;
	if (r > 255) r = 255;
	else if  (r < 0) r = 0;
	var b = ((num >> 8) & 0x00FF) + amount;
	if (b > 255) b = 255;
	else if  (b < 0) b = 0;
	var g = (num & 0x0000FF) + amount;
	if (g > 255) g = 255;
	else if (g < 0) g = 0;
	return "#" + (g | (b << 8) | (r << 16)).toString(16);
}

function castRay(px, py, ra) {
			//---Vertical--- 
			let rx, ry;
			let xo=0; let yo=0; let mx=0; let my=0; let mp=0; let vx=0; let vy=0;
			let dof=0; let side=0; let disV=100000;
			let Tan=Math.tan(degToRad(ra));
					if(Math.cos(degToRad(ra))> 0.001) { rx=((px>>6)<<6)+64;       ry=(px-rx)*Tan+py; xo= 64; yo=-xo*Tan;} //looking left
			else if(Math.cos(degToRad(ra))<-0.001){ rx=((px>>6)<<6) -0.0001;  ry=(px-rx)*Tan+py; xo=-64; yo=-xo*Tan;} //looking right
			else { rx=px; ry=py; dof=MAXDOF;}  //looking up or down. no hit  
		
			while(dof<MAXDOF) { 
				mx=(rx)>>6; my=(ry)>>6; mp=my*MAPW+mx;                     
				if(mp>0 && mp<MAPW*MAPH && MAP[mp]==1){ dof=MAXDOF; disV=Math.cos(degToRad(ra))*(rx-px)-Math.sin(degToRad(ra))*(ry-py);} //hit
				else{ rx+=xo; ry+=yo; dof+=1;} //check next horizontal
			} 
			vx=rx; vy=ry;

			//---Horizontal---
			dof=0; let disH=100000;
			Tan=1.0/Tan; 
					if(Math.sin(degToRad(ra))> 0.001){ ry=((py>>6)<<6) -0.0001; rx=(py-ry)*Tan+px; yo=-64; xo=-yo*Tan;} //looking up 
			else if(Math.sin(degToRad(ra))<-0.001){ ry=((py>>6)<<6)+64;     rx=(py-ry)*Tan+px; yo= 64; xo=-yo*Tan;} //looking down
			else{ rx=px; ry=py; dof=MAXDOF;} //looking straight left or right
		
			while(dof<MAXDOF) { 
				mx=(rx)>>6; my=(ry)>>6; mp=my*MAPW+mx;
				if(mp>0 && mp<MAPW*MAPH && MAP[mp]==1){ dof=MAXDOF; disH=Math.cos(degToRad(ra))*(rx-px)-Math.sin(degToRad(ra))*(ry-py);} //hit
				else{ rx+=xo; ry+=yo; dof+=1;} //check next horizontal
			}
			if(disV<disH){ rx=vx; ry=vy; disH=disV; } //horizontal hit first
			
			return { rx: rx, ry: ry, disH: disH, disV: disV };
}

class Player {
	constructor() {
		this.x = 150;
		this.y = 500;
		this.a = 90;
		this.dx = Math.cos(degToRad(this.a));
		this.dy = -Math.sin(degToRad(this.a));
	}
}

class Renderer extends core2d.Sprite {
	constructor(x=0, y=0) {
		super(x, y);
		this.setWidth(scene.width);
		this.setHeight(scene.height);
		this.controller = Core2D.getController();
	}

	update() {
		if (this.controller.keyDown(Command.LEFT)) {
			player.a += 5; player.a=fixAng(player.a); player.dx=Math.cos(degToRad(player.a)); player.dy=-Math.sin(degToRad(player.a));
		} else if (this.controller.keyDown(Command.RIGHT)) {
			player.a -= 5; player.a=fixAng(player.a); player.dx=Math.cos(degToRad(player.a)); player.dy=-Math.sin(degToRad(player.a));
		}

		if (this.controller.keyDown(Command.UP)) {
			player.x += player.dx*5; player.y += player.dy*5;
		} else if (this.controller.keyDown(Command.DOWN)) {
			player.x -= player.dx*5;	player.y -= player.dy;
		}
	}

	render(context) {
		let ra=fixAng(player.a+FOV); 
		for(let r=0;r<FOV*2;r++) {
			let ray = castRay(player.x, player.y, ra);
			let lineH = (BLOCKSIZE*scene.height)/(ray.disH);
			if(lineH>scene.height) { lineH=scene.height;} //line height and limit
			if(lineH>1) {
				let lineOff = scene.height/2 - (lineH>>1);
				let lineWidth = (Math.ceil(scene.width/FOV))/2;
				let colorDist = parseInt(-ray.disH/8); if (colorDist < -66) { colorDist=-66; }

				context.strokeStyle = lightenDarkenColor('#666666', colorDist);
				context.beginPath();
				context.lineWidth = lineWidth+1;
				context.moveTo(r*lineWidth, lineOff);
				context.lineTo(r*lineWidth, lineOff+lineH);
				context.stroke();
			}
			ra=fixAng(ra-1);
		}
	}

}

class MapView extends core2d.Sprite {
	constructor(x=0, y=0) {
		super(x, y);
		this
			.setWidth(BLOCKSIZE/BLOCKDIV*10)
			.setHeight(BLOCKSIZE/BLOCKDIV*10)
			.setRight(scene.width-BLOCKSIZE/BLOCKDIV)
			.setBottom(scene.height-BLOCKSIZE/BLOCKDIV);
	}

	render(context) {
		context.fillStyle = Color.Black;
		context.fillRect(this.x, this.y, this.width, this.height);
		// map
		for(let y=0; y<MAPH;++y) {
			for(let x=0; x<MAPW;++x) {
				if (MAP[y*MAPW+x]===1) { context.fillStyle = Color.Blue; }
				else { context.fillStyle = Color.Gray; }
				context.fillRect(this.left+1+(BLOCKSIZE/BLOCKDIV*x), this.top+1+(BLOCKSIZE/BLOCKDIV*y), BLOCKSIZE/BLOCKDIV-1, BLOCKSIZE/BLOCKDIV-1);
			}
		}
		// view area
		let ray = castRay(player.x, player.y, fixAng(player.a+FOV));
		context.strokeStyle = Color.Red;
		context.beginPath();
		context.lineWidth = 1;
		context.moveTo(this.left+player.x/BLOCKDIV, this.top+player.y/BLOCKDIV);
		context.lineTo(this.left+ray.rx/BLOCKDIV, this.top+ray.ry/BLOCKDIV);
		context.stroke();
		ray = castRay(player.x, player.y, fixAng(player.a-FOV));
		context.beginPath();
		context.lineWidth = 1;
		context.moveTo(this.left+player.x/BLOCKDIV, this.top+player.y/BLOCKDIV);
		context.lineTo(this.left+ray.rx/BLOCKDIV, this.top+ray.ry/BLOCKDIV);
		context.stroke();
		debug.text = player.a;
		
		//Draw Player
		context.fillStyle = Color.Yellow;
		context.fillRect(this.left+player.x/BLOCKDIV-4, this.top+player.y/BLOCKDIV-4, 8, 8);
		context.strokeStyle = Color.Yellow;
		context.beginPath();
		context.lineWidth = 3;
		context.moveTo(this.left+player.x/BLOCKDIV, this.top+player.y/BLOCKDIV);
		context.lineTo((this.left+player.x/BLOCKDIV)+player.dx*3, (this.top+player.y/BLOCKDIV)+player.dy*3);
		context.stroke();
	}
}

let player = new Player();
let scene = Core2D.scene().setColor('#000028');
let renderer = new Renderer();
scene.add(renderer);
let mapView = new MapView();
scene.add(mapView);

const debug = new TextSprite().setWidth(160).setHeight(16).setRight(scene.right-64).setTop(scene.top);
scene.add(debug);

Core2D.setName("RayCaster");
Core2D.setAutoScale(false);
Core2D.init(scene);
