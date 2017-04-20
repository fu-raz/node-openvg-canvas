/*jslint indent: 2, node: true */
"use strict";

var vg = require('openvg');
var context = require('./context.js');
var Image = require('./image.js');
var Path = require('./path.js');
var DrawingStyle = require('./drawingStyle');
var m = require('./matrix.js');
var MemoryManager = require('./memoryManager');

var notImplemented = function () {
  return 'Not Implemented';
};

var Canvas = module.exports = function (width, height) {
  var self = this;
  var bufferTransform = m.create();

  vg.init();

  width  = vg.screen.width;
  height = vg.screen.height;

  var context2d;

  function getWidth() { return width; }
  Object.defineProperty(this, 'width', { enumerable: true, get: getWidth });

  function getHeight() { return height; }
  Object.defineProperty(this, 'height', { enumerable: true, get: getHeight });

  context2d = context.createCanvasRenderingContext2D(this);

  var bufferContext = vg.egl.createContext(vg.screen.context);

  this.toDataURL = notImplemented;
  this.toDataURLHD = notImplemented;
  this.toBlob = notImplemented;
  this.toBlobHD = notImplemented;

  this.getContext = function (contextId, args) {
    if (contextId === '2d') {
      return context2d;
    } else {
      return null;
    }
  };

  // Conform to node-canvas API
  this.toBuffer = function () {
    return image.saveToBuffer(context2d.getImageData(0, 0, width, height));
  };

  this.vgSwapBuffers = function () {
    Canvas.vgSwapBuffers();
  };

  this.switchToBuffer = function ()
  {
    var bufferImage =
        vg.createImage(vg.VGImageFormat.VG_sARGB_8888,
                       width, height,
                       vg.VGImageQuality.VG_IMAGE_QUALITY_BETTER);
      // shadowDstImage =
      //   vg.createImage(vg.VGImageFormat.VG_sARGB_8888,
      //                  width, height,
      //                  vg.VGImageQuality.VG_IMAGE_QUALITY_BETTER);
      var bufferSurface = vg.egl.createPbufferFromClientBuffer(bufferImage);
      vg.getMatrix(bufferTransform);
      var success = vg.egl.makeCurrent(bufferSurface, bufferContext);
      vg.loadMatrix(bufferTransform);
      vg.clear(0, 0, width, height);

      return bufferImage;
  }

  this.paintBuffer = function(bufferImage)
  {
    var blendMode = vg.getI(vg.VGParamType.VG_BLEND_MODE);

    vg.getMatrix(bufferTransform);
    vg.loadIdentity();
    // Set the required blend mode:
    vg.setI(vg.VGParamType.VG_BLEND_MODE, vg.VGBlendMode.VG_BLEND_SRC_OVER);
    vg.drawImage(bufferImage);
    vg.loadMatrix(bufferTransform);
    vg.setI(vg.VGParamType.VG_BLEND_MODE, blendMode);
  }

  this.switchToScreen = function()
  {
      var success = vg.egl.makeCurrent(vg.screen.surface, vg.screen.context);
  }
};

// My own memory manager
Canvas.MemoryManager = MemoryManager;

// Conform to node-canvas API
Canvas.Image = Image;

Canvas.Path = Path;
Canvas.SVGMatrix = m.SVGMatrix;
Canvas.DrawingStyle = DrawingStyle;

Canvas.vgSwapBuffers = function (surface) {
  if (!surface)
    surface = vg.screen.surface
  vg.egl.swapBuffers(surface);
};

// Based on http://paulirish.com/2011/requestanimationframe-for-smart-animating/
// No need for iife, module scope is already isolated
if (!global.requestAnimationFrame) {
  var lastTime = 0;

  global.requestAnimationFrame = function (callback) {
    var currTime = Date.now();
    var timeToCall = Math.max(0, 16 - (currTime - lastTime));
    var id = setTimeout(function () {
        callback(currTime + timeToCall);
        Canvas.vgSwapBuffers();
      },
      timeToCall);
    lastTime = currTime + timeToCall;
    return id;
  };

  global.cancelAnimationFrame = function (id) {
    clearTimeout(id);
  };
}
