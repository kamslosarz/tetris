'use strict';

class EventListener {
  static listeners = [];

  static dispatchEvent(type, parameters) {
    if (EventListener.listeners.hasOwnProperty(type)) {
      for (const callback of EventListener.listeners[type]) {
        callback(parameters);
      }
    }
  }

  static addEventListener(type, callback) {
    if (!EventListener.listeners.hasOwnProperty(type)) {
      EventListener.listeners[type] = [];
    }
    EventListener.listeners[type].push(callback);
  }
}

class Game extends EventListener {
  static states = {
    pause: 0,
    start: 1,
    end: 2,
  };
  static state = 0;
  static score = 0;
  static listeners;

  constructor() {
    super();
    const gameCanvas = document.getElementById('game');
    gameCanvas.focus();
    this.gameMatrix = new Matrix(20, 10, gameCanvas);
    const shapeCanvas = document.getElementById('shape');
    this.shapeMatrix = new Matrix(4, 4, shapeCanvas);
    Game.state = Game.states.start;
  }

  play() {
    this.shapeFeeder = new ShapeFeeder(this.gameMatrix, this.shapeMatrix);
    const cycle = () => {
      if (Game.isStarted()) {
        this.shapeFeeder.startFeeding();
      }
    };
    this.cycleInterval = setInterval(cycle, 1000);
    cycle();
    Game.addEventListener('end', () => {
      clearInterval(this.cycleInterval);
      this.gameMatrix.reset();
      this.gameMatrix.render();
      this.shapeMatrix.reset();
      this.shapeMatrix.render();
      console.log(1);
      document.getElementById('over').style.display = 'block';
      document.getElementById('pause').style.display = 'none';
      Game.state = Game.states.end;
    });
    Game.addEventListener('addScore', (score) => {
      Game.score += score;
      document.getElementById('score').innerText = Game.score;
    });
    Game.addEventListener('resume', (score) => {
      Game.state = Game.states.start;
    });
    Game.addEventListener('pause', (score) => {
      Game.state = Game.states.pause;
    });
    this.attachListeners();
  }

  attachListeners() {
    KeyboardListener.addEventListener('ArrowUp', async () => {
      if (Game.isStarted()) {
        this.shapeFeeder.reverseShape();
      }
    });
    KeyboardListener.addEventListener('ArrowLeft', () => {
      if (Game.isStarted()) {
        this.shapeFeeder.moveShapeSide('left');
      }
    });
    KeyboardListener.addEventListener('ArrowRight', () => {
      if (Game.isStarted()) {
        this.shapeFeeder.moveShapeSide('right');
      }
    });
    KeyboardListener.addEventListener('ArrowDown', () => {
      if (Game.isStarted()) {
        this.shapeFeeder.moveShapeDown();
      }
    });
    KeyboardListener.addEventListener('KeyP', () => {
      const pause = document.getElementById('pause');
      const resume = document.getElementById('resume');
      if (Game.isPaused()) {
        Game.dispatchEvent('resume');
        resume.style.display = 'none';
        pause.style.display = 'inline-block';
      } else {
        Game.dispatchEvent('pause');
        pause.style.display = 'none';
        resume.style.display = 'inline-block';
      }
    });
    KeyboardListener.addEventListener('Space', () => {
      if (Game.isStarted()) {
        this.shapeFeeder.moveShapeMaxDown();
      }
    });
  }

  static isStarted() {
    return Game.state === Game.states.start;
  }

  static isPaused() {
    return Game.state === Game.states.pause;
  }
}

class ShapeFeeder {
  #activeShape;
  #nextShape;
  #gameMatrix;
  #shapeMatrix;

  constructor(gameMatrix, shapeMatrix) {
    this.#gameMatrix = gameMatrix;
    this.#shapeMatrix = shapeMatrix;
    this.#assignNextShape();
  }

  reverseShape() {
    if (this.#activeShape) {
      let points = [];
      const currentPoints = this.#activeShape.points;
      const currentH = currentPoints.map((p) => p.h).sort().reverse()[0];
      const coordinates = this.#activeShape.reversedCoordinates;
      const currentW = currentPoints.map((p) => p.w).sort()[0];
      const maxW = coordinates.map((c) => c[1]).sort().reverse()[0];
      let wCorrection = 0;
      if ((maxW + currentW) > this.#gameMatrix.width) {
        wCorrection = (maxW + currentW) - this.#gameMatrix.width;
      }
      for (let coordinate of coordinates) {
        const h = coordinate[0] - (3 - currentH);
        let w = (currentW + coordinate[1]) - wCorrection;
        if (h < 0) {
          points.push(new Point(h, w));
        } else {
          let p = this.#gameMatrix.getPoint(h, w);
          if (p && (!p.shape || this.#activeShape.equals(p.shape))) {
            points.push(p);
          }
        }
      }
      if (points.length === 4) {
        this.#gameMatrix.resetPoints(this.#activeShape.points);
        this.#gameMatrix.setPointsShape(points, this.#activeShape);
        this.#activeShape.points = points;
        this.#activeShape.reverse();
        this.#gameMatrix.render();
      }
    }
  }

  moveShapeSide(side) {
    if (this.#activeShape) {
      const nextPoints = this.#getSideMovePoints(side, this.#gameMatrix);
      if (nextPoints.length === 4) {
        this.#gameMatrix.resetPoints(this.#activeShape.points);
        this.#gameMatrix.setPointsShape(nextPoints, this.#activeShape);
        this.#activeShape.points = nextPoints;
        this.#gameMatrix.render();
      }
    }
  }

  moveShapeMaxDown() {
    if (this.#activeShape) {
      const points = this.#getLastMovePoints(this.#gameMatrix);
      if (points.length === 4) {
        this.#gameMatrix.resetPoints(this.#activeShape.points);
        this.#gameMatrix.setPointsShape(points, this.#activeShape);
        this.#activeShape.points = points;
        if(!this.checkIfEnd()){
          this.#gameMatrix.render();
          this.checkScore();
          this.putShape();
        }
      }
    }
  }

  moveShapeDown() {
    if (this.#activeShape) {
      this.moveShape();
      this.#gameMatrix.render();
    }
  }

  moveShape() {
    const nextPoints = this.#getNextMovePoints();
    if (nextPoints.length === 4) {
      this.#gameMatrix.resetPoints(this.#activeShape.points);
      this.#gameMatrix.setPointsShape(nextPoints, this.#activeShape);
      this.#activeShape.points = nextPoints;
    } else {
      if(!this.checkIfEnd()){
        this.checkScore();
        this.#activeShape = null;
        this.putShape();
      }
    }
  }

  checkScore() {
    const fullLines = this.#gameMatrix.getFullLines();
    if (fullLines.length) {
      Game.dispatchEvent('addScore',
          fullLines.length * (10 + fullLines.length - 1));
      this.#gameMatrix.scoreAquired(fullLines);
    }
    this.#gameMatrix.render();
  }

  putShape() {
    this.#activeShape = this.#nextShape;
    this.#assignNextShape();
  }

  checkIfEnd() {
    for (let point of this.#activeShape.points) {
      if (point.h < 0) {
        Game.dispatchEvent('end');
        return true;
      }
    }
    return false;
  }

  startFeeding() {
    if (this.#activeShape) {
      this.moveShape();
    } else {
      this.putShape();
    }
    this.#gameMatrix.render();
  }

  #assignNextShape = () => {
    const shapes = Object.keys(Shape.shapeTypes);
    const randomShape = shapes[Math.floor(Math.random() * shapes.length)];
    this.#nextShape = new Shape(randomShape);
    this.#shapeMatrix.reset();
    for (const coordinate of this.#nextShape.coordinates) {
      const point = this.#shapeMatrix.getPoint(coordinate[0], coordinate[1]);
      point.shape = this.#nextShape;
    }
    this.#shapeMatrix.render();
  };

  #getLastMovePoints = () => {
    let points = this.#activeShape.points;
    do {
      let nextPoints = [];
      for (let point of points) {
        const h = point.h + 1;
        if (h >= 0) {
          let nextPoint = this.#gameMatrix.getPoint(h, point.w);
          if (nextPoint) {
            if (!nextPoint.shape || this.#activeShape.equals(nextPoint.shape)) {
              nextPoints.push(nextPoint);
            }
          }
        } else {
          nextPoints.push(new Point(h, point.w));
        }
      }
      if (nextPoints.length === 4) {
        points = nextPoints;
      } else {
        break;
      }
    } while (true);

    return points;
  };

  #getSideMovePoints = (side) => {
    let nextPoints = [];
    const points = this.#activeShape.points;
    for (let point of points) {
      const w = (side === 'left' ? point.w - 1 : point.w + 1);
      if (point.h < 0) {
        nextPoints.push(new Point(point.h, w));
      } else {
        let nextPoint = this.#gameMatrix.getPoint(point.h, w);
        if (nextPoint) {
          if (!nextPoint.shape || this.#activeShape.equals(nextPoint.shape)) {
            nextPoints.push(nextPoint);
          }
        }
      }
    }
    return nextPoints;
  };

  #getNextMovePoints = () => {
    let nextPoints = [];
    for (let point of this.#activeShape.points) {
      if (point.isOutOfMatrix() && (point.h + 1) < 0) {
        nextPoints.push(new Point(point.h + 1, point.w));
      } else {
        let nextPoint = this.#gameMatrix.getPoint(point.h + 1, point.w);
        if (nextPoint) {
          if (!nextPoint.shape || this.#activeShape.equals(nextPoint.shape)) {
            nextPoints.push(nextPoint);
          }
        }
      }
    }
    return nextPoints;
  };
}

class Matrix {
  #height;
  #width;
  #context;
  static #shapeSize = 25;
  matrix = [];

  get width() {
    return this.#width - 1;
  }

  constructor(height, width, canvas) {
    this.#height = height;
    this.#width = width;
    this.reset();
    this.#context = canvas.getContext('2d');
    this.#context.beginPath();
  }

  scoreAquired(lines) {
    for (const line of lines) {
      for (let i = this.matrix.length - 1; i > 0; i--) {
        const point = this.matrix[i];
        if (point.h === line.h) {
          point.shape = null;
        } else if (point.h < line.h) {
          const newPoint = this.getPoint(point.h + 1, point.w);
          newPoint.shape = point.shape;
        }
      }
    }
    this.render();
  }

  reset() {
    this.matrix = [];
    for (let h = 0; h < this.#height; h++) {
      for (let w = 0; w < this.#width; w++) {
        this.matrix.push(new Point(h, w));
      }
    }
  }

  resetPoints(points) {
    for (let p of points) {
      if (!p.isOutOfMatrix()) {
        const point = this.getPoint(p.h, p.w);
        point.shape = null;
      }
    }
  }

  setPointsShape(points, shape) {
    for (let p of points) {
      if (!p.isOutOfMatrix()) {
        const point = this.getPoint(p.h, p.w);
        point.shape = shape;
      }
    }
  }

  getPoint(h, w) {
    return this.matrix.find((point) => point.h === h && point.w === w);
  }

  render() {
    for (let point of this.matrix) {
      let w = point.w * Matrix.#shapeSize;
      let h = point.h * Matrix.#shapeSize;
      this.#context.strokeStyle = point.strokeColor;
      this.#context.strokeRect(w, h, Matrix.#shapeSize, Matrix.#shapeSize);
      this.#context.fillStyle = point.color;
      this.#context.fillRect(w, h, Matrix.#shapeSize, Matrix.#shapeSize);
    }
  }

  getFullLines() {
    const lines = [];
    for (let point of this.matrix) {
      if (point.shape) {
        if (!lines.hasOwnProperty(point.h)) {
          lines[point.h] = {h: point.h, shapesCount: 0};
        }
        lines[point.h].shapesCount++;
      }
    }
    return lines.filter((l) => l.shapesCount === this.#width);
  }
}

class Point {
  h = 0;
  w = 0;
  #shape = null;
  strokeColor = '#cdcdcd';
  #color = '#fff';

  constructor(h, w) {
    this.h = h;
    this.w = w;
  }

  get shape() {
    return this.#shape;
  }

  set shape(shape) {
    this.#shape = shape;
  }

  isOutOfMatrix() {
    return this.h < 0 || this.w > 10 || this.w < 0;
  }

  get color() {
    if (this.#shape) {
      return this.#shape.color;
    }
    return this.#color;
  }
}

class Shape {
  static shapeTypes = {
    I: [
      [[0, 0], [1, 0], [2, 0], [3, 0]],
      [[3, 0], [3, 1], [3, 2], [3, 3]],
    ],
    T: [
      [[3, 0], [3, 1], [3, 2], [2, 1]],
      [[1, 0], [2, 0], [2, 1], [3, 0]],
      [[2, 0], [2, 1], [2, 2], [3, 1]],
      [[1, 1], [2, 1], [3, 1], [2, 0]],
    ],
    O: [
      [[2, 0], [2, 1], [3, 0], [3, 1]],
    ],
    J: [
      [[1, 1], [2, 1], [3, 1], [3, 0]],
      [[2, 0], [3, 0], [3, 1], [3, 2]],
      [[1, 0], [2, 0], [3, 0], [1, 1]],
      [[2, 0], [2, 1], [3, 2], [2, 2]],
    ],
    L: [
      [[1, 0], [2, 0], [3, 0], [3, 1]],
      [[2, 0], [2, 1], [2, 2], [3, 0]],
      [[1, 0], [1, 1], [2, 1], [3, 1]],
      [[3, 0], [3, 1], [3, 2], [2, 2]],
    ],
    S: [
      [[2, 1], [2, 2], [3, 0], [3, 1]],
      [[1, 0], [2, 0], [2, 1], [3, 1]],
    ],
    Z: [
      [[2, 0], [2, 1], [3, 1], [3, 2]],
      [[2, 0], [3, 0], [1, 1], [2, 1]],
    ],
  };

  color;
  points = [];
  position = 0;

  constructor(type, position = null) {
    this.type = Shape.shapeTypes[type];
    if (position !== null) {
      this.position = position;
    } else {
      this.position = Math.floor(Math.random() * this.type.length);
    }
    this.points = this.basePoints;
    this.color = Shape.#getRandomColor();
    this.hash = '_' + Math.random().toString(36).substr(2, 9);
  }

  get basePoints() {
    let base = [];
    for (let coordinate of this.coordinates) {
      base.push(new Point(coordinate[0] - 4, coordinate[1] + 3));
    }
    return base;
  }

  get color() {
    return this.color;
  }

  get coordinates() {
    return this.type[this.position];
  }

  get points() {
    return this.basePoints;
  }

  get nextPosition() {
    const maxPosition = this.type.length - 1;
    if (maxPosition === this.position) {
      return 0;
    } else {
      return this.position + 1;
    }
  }

  reverse() {
    this.position = this.nextPosition;
  }

  get reversedCoordinates() {
    return this.type[this.nextPosition];
  }

  static #getRandomColor = () => {
    const red = Math.floor((200 - 50) * Math.random());
    const green = Math.floor((200 - 50) * Math.random());
    const blue = Math.floor((200 - 50) * Math.random());

    return 'rgb(' + red + ', ' + green + ', ' + blue + ')';
  };

  equals(shape) {
    return shape.hash === this.hash;
  }
}

class KeyboardListener extends EventListener {}

document.addEventListener('keydown', (e) => {
  KeyboardListener.dispatchEvent(e.code, {});
});
const game = new Game();
game.play();