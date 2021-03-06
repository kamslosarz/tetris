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

  static addEventListener(types, callback) {
    for (const type of types.split(' ')) {
      if (!EventListener.listeners.hasOwnProperty(type)) {
        EventListener.listeners[type] = [];
      }
      EventListener.listeners[type].push(callback);
    }
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
    const nextShapeCanvas = document.getElementById('nextShape');
    this.nextShapeMatrix = new Matrix(4, 4, nextShapeCanvas);
    const holdShapeCanvas = document.getElementById('holdShape');
    this.holdShapeMatrix = new Matrix(4, 4, holdShapeCanvas);
    Game.state = Game.states.start;
  }

  play() {
    this.shapeFeeder = new ShapeFeeder(this.gameMatrix, this.nextShapeMatrix,
        this.holdShapeMatrix);
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
      this.nextShapeMatrix.reset();
      this.nextShapeMatrix.render();
      this.holdShapeMatrix.reset();
      this.holdShapeMatrix.render();
      document.getElementById('over').style.display = 'block';
      document.getElementById('pause').style.display = 'none';
      Game.state = Game.states.end;
    });
    Game.addEventListener('addScore', (score) => {
      Game.score += score;
      document.getElementById('score').innerText = Game.score;
    });
    Game.addEventListener('resume', () => {
      Game.state = Game.states.start;
    });
    Game.addEventListener('pause', () => {
      Game.state = Game.states.pause;
    });
    this.attachListeners();
  }

  attachListeners() {
    KeyboardListener.addEventListener('ArrowUp SwipeUp', async () => {
      if (Game.isStarted()) {
        this.shapeFeeder.reverseShape();
      }
    });
    KeyboardListener.addEventListener('ArrowLeft SwipeLeft', () => {
      if (Game.isStarted()) {
        this.shapeFeeder.moveShapeSide('left');
      }
    });
    KeyboardListener.addEventListener('ArrowRight SwipeRight', () => {
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
    KeyboardListener.addEventListener('KeyC', () => {
      this.shapeFeeder.holdActualShape();
    });
    KeyboardListener.addEventListener('Space touch SwipeDown', () => {
      if (Game.isStarted()) {
        this.shapeFeeder.moveShapeMaxDown();
      }
    });
    document.getElementById('arrow-up').addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      KeyboardListener.dispatchEvent('ArrowUp');
      return false;
    });
    document.getElementById('arrow-down').addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      KeyboardListener.dispatchEvent('ArrowDown');
      return false;
    });
    document.getElementById('arrow-left').addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      KeyboardListener.dispatchEvent('ArrowLeft');
      return false;
    });
    document.getElementById('arrow-right').addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      KeyboardListener.dispatchEvent('ArrowRight');
      return false;
    });
    document.getElementById('c').addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      KeyboardListener.dispatchEvent('KeyC');
      return false;
    });
    document.getElementById('space').addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      KeyboardListener.dispatchEvent('Space');
      return false;
    });
    document.getElementById('pause').addEventListener('click', () => {
      const pause = document.getElementById('pause');
      const resume = document.getElementById('resume');
      Game.dispatchEvent('pause');
      pause.style.display = 'none';
      resume.style.display = 'inline-block';
    });
    document.getElementById('resume').addEventListener('click', () => {
      const pause = document.getElementById('pause');
      const resume = document.getElementById('resume');
      Game.dispatchEvent('resume');
      resume.style.display = 'none';
      pause.style.display = 'inline-block';
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
  #nextShapeMatrix;
  #holdShapeMatrix;
  #shapeOnHold;

  constructor(gameMatrix, nextShapeMatrix, holdShapeMatrix) {
    this.#gameMatrix = gameMatrix;
    this.#nextShapeMatrix = nextShapeMatrix;
    this.#holdShapeMatrix = holdShapeMatrix;
    this.#holdShapeMatrix.render();
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
        if (!this.checkIfEnd()) {
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
      if (!this.checkIfEnd()) {
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

  holdActualShape() {
    if (!this.#activeShape.wasHold) {
      if (!this.#shapeOnHold) {
        this.resetMatrix(this.#gameMatrix, this.#activeShape);
        this.#shapeOnHold = this.#activeShape;
        this.#shapeOnHold.wasHold = true;
        this.#activeShape.reset();
        this.#activeShape = this.#nextShape;
        this.#activeShape.wasHold = true;
        this.#assignNextShape();
        this.#renderHoldShape();
      } else {
        this.resetMatrix(this.#gameMatrix, this.#activeShape);
        this.#activeShape.reset();
        const activeShape = this.#activeShape;
        this.#activeShape = this.#shapeOnHold;
        this.#shapeOnHold = activeShape;
        this.#shapeOnHold.wasHold = true;
        this.#activeShape.wasHold = true;
        this.#renderHoldShape();
      }
    }
  }

  resetMatrix(matrix, shape) {
    for (const point of shape.points) {
      const p = matrix.getPoint(point.h, point.w);
      if (p) {
        p.shape = null;
      }
    }
    matrix.render();
  }

  #assignNextShape = () => {
    const shapes = Object.keys(Shape.shapeTypes);
    const randomShape = shapes[Math.floor(Math.random() * shapes.length)];
    this.#nextShape = new Shape(randomShape);
    this.#nextShapeMatrix.reset();
    this.#renderNextShape();
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
      let w = (side === 'left' ? point.w - 1 : point.w + 1);
      if (w < 0 || w > this.#gameMatrix.width) {
        continue;
      }
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
    return nextPoints.length === 4 ? nextPoints : points;
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

  #renderNextShape = () => {
    this.#nextShapeMatrix.reset();
    for (const coordinate of this.#nextShape.coordinates) {
      const point = this.#nextShapeMatrix.getPoint(coordinate[0],
          coordinate[1]);
      point.shape = this.#nextShape;
    }
    this.#nextShapeMatrix.render();
  };

  #renderHoldShape = () => {
    this.#holdShapeMatrix.reset();
    for (const coordinate of this.#shapeOnHold.coordinates) {
      const point = this.#holdShapeMatrix.getPoint(coordinate[0],
          coordinate[1]);
      point.shape = this.#shapeOnHold;
    }
    this.#holdShapeMatrix.render();
  };
}

class Matrix {
  #height;
  #width;
  #context;
  static #shapeSize = 25;
  matrix = [];

  constructor(height, width, canvas) {
    this.#height = height;
    this.#width = width;
    this.reset();
    this.#context = canvas.getContext('2d');
    this.#context.beginPath();
  }

  static get shapeSize() {
    return Matrix.#shapeSize;
  }

  get width() {
    return this.#width - 1;
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
  wasHold = false;

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

  reset() {
    this.points = this.basePoints;
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

class KeyboardListener extends EventListener {
  static keys() {
    document.addEventListener('keydown', (e) => {
      KeyboardListener.dispatchEvent(e.code, {});
    });
  }

  static dispatchMultiple(event, times, parameters) {
    for (let i = 0; i < times; i++) {
      KeyboardListener.dispatchEvent(event, parameters);
    }
  }

  static touches() {
    const dispatchMoveX = (moves, side) => {
      if (side === 'left') {
        KeyboardListener.dispatchMultiple('SwipeLeft', moves);
      } else {
        KeyboardListener.dispatchMultiple('SwipeRight', moves);
      }
    };
    let touchEvent = {start: false, y: 0};
    document.addEventListener('touchstart', (e) => {
      if (e.changedTouches.length === 1) {
        touchEvent.start = e.changedTouches[0];
        touchEvent.y = e.changedTouches[0].clientY;
      }
    });
    document.addEventListener('touchmove', (e) => {
      if (!touchEvent.start || e.changedTouches.length !== 1) {
        return false;
      }
      const touch = e.changedTouches[0];
      let touchY = touch.clientY - touchEvent.y;
      touchY = touchY < 0 ? -touchY : touchY;
      let movedX = touchEvent.start.clientX - touch.clientX;
      let side = 'left';
      if (movedX < 0) {
        side = 'right';
        movedX = -movedX;
      }
      if (movedX > touchY) {
        movedX = movedX * 1.3;
        let moves = Math.floor(movedX / Matrix.shapeSize);
        if (moves > 0) {
          touchEvent.start = touch;
          dispatchMoveX(moves, side);
        }
      }
    });
    document.addEventListener('touchend', (e) => {
      if (!touchEvent.start || e.changedTouches.length !== 1) {
        return false;
      }
      const touchEnd = e.changedTouches[0];
      let movedY = touchEvent.start.clientY - touchEnd.clientY;
      let movedX = touchEvent.start.clientX - touchEnd.clientX;
      let side = 'up';
      if (movedY < 0) {
        side = 'down';
      }
      movedY = movedY < 0 ? -movedY : movedY;
      movedX = movedX < 0 ? -movedX : movedX;
      if (touchEnd.target.id === 'game' && !movedY && !movedX) {
        KeyboardListener.dispatchEvent('touch');
      } else {
        if (movedY > movedX) {
          if (side === 'up') {
            KeyboardListener.dispatchEvent('SwipeUp');
          } else {
            KeyboardListener.dispatchEvent('SwipeDown');
          }
        }
      }
      touchEvent = {start: false};
    });
    document.addEventListener('touchcancel', (e) => {
      touchEvent = {start: false};
    });
  }
}

KeyboardListener.keys();
KeyboardListener.touches();
const game = new Game();
game.play();