var vg = require('openvg');
var freeimage = require('node-freeimage');
var finalize = require('./finalize');
var m = require('./matrix');
var ref = require('ref');
var MemoryManager = require('./memoryManager');

var Image = function (width, height) {
    finalize(this, imageFinalizer);

    this.width = width;
    this.height = height;
    this._src = undefined;
    this.data = undefined;
    this._handle = undefined;
    this._memoryManagerIndex = 0;

    Object.defineProperty(this, 'src', {set: this.setSource, get: this.getSource});
    Object.defineProperty(this, 'handle', {get: this.getHandle});
};

Image.getImageData = function(data)
{
    // Make room in memory
    var fimem = freeimage.openMemory(data, data.length);
    // Load 
    var bitmap = freeimage.loadFromMemory(freeimage.getFileTypeFromMemory(fimem, 0), fimem);
    
    if (freeimage.getBPP(bitmap) != 32) {
        var oldbitmap = bitmap;
        bitmap = freeimage.convertTo32Bits(oldbitmap);
        freeimage.unload(oldbitmap);
    }

    var imageData = {
        width: freeimage.getWidth(bitmap),
        height: freeimage.getHeight(bitmap),
        bpp: freeimage.getBPP(bitmap)
    };
    
    var bits = freeimage.getBits(bitmap);
    imageData.data = new Buffer(ref.reinterpret(bits, (Math.ceil((imageData.width * imageData.bpp / 8) / 4) * 4) * imageData.height, 0));
    // Flip image
    imageData.data = imageData.data.slice((imageData.height - 1) * (imageData.width * 4), imageData.height * (imageData.width * 4));

    freeimage.unload(bitmap);
    freeimage.closeMemory(fimem);
};

Image.fromImageData = function(imageData)
{
    var image = new Image(imageData.width, imageData.height);
    image.bpp = imageData.bpp;
    image.data = imageData.data;
    image._memoryManagerIndex = MemoryManager.add(image);
    return image;
};

Image.prototype.setSource = function (data) {
    this._src = data;
    if (data instanceof Buffer) {
        var fimem = freeimage.openMemory(data, data.length);
        var bitmap = freeimage.loadFromMemory(freeimage.getFileTypeFromMemory(fimem, 0), fimem);
        bitmap = this._loadBitmap(bitmap);
        freeimage.unload(bitmap);
        freeimage.closeMemory(fimem);
    } else if (typeof data === 'string') {
        if (data.startsWith('data:image/')) {
            throw new Error("not implemented");
        } else {
            var bitmap = freeimage.load(freeimage.getFileType(this._src), this._src);
            bitmap = this._loadBitmap(bitmap);
            freeimage.unload(bitmap);
        }
    } else {
        this._src = undefined;
        throw new TypeError('src data has to be Buffer or String');
    }
    this._memoryManagerIndex = MemoryManager.add(this);
};

Image.prototype._loadBitmap = function (bitmap) {
    if (freeimage.getBPP(bitmap) != 32) {
        var oldbitmap = bitmap;
        bitmap = freeimage.convertTo32Bits(oldbitmap);
        freeimage.unload(oldbitmap);
    }

    this.width = freeimage.getWidth(bitmap);
    this.height = freeimage.getHeight(bitmap);
    this.bpp = freeimage.getBPP(bitmap);
    var bits = freeimage.getBits(bitmap);
    this.data = new Buffer(ref.reinterpret(bits, (Math.ceil((this.width * this.bpp / 8) / 4) * 4) * this.height, 0));

    // Flip image
    this.data = this.data.slice((this.height - 1) * (this.width * 4), this.height * (this.width * 4));

    return bitmap;
};

Image.prototype.getSource = function () {
    return this._src;
};

Image.prototype.upload = function () {
    if (!this.data) throw new Error("no image data");
    if (this._handle) throw new Error("already uploaded");
    this._handle = vg.createImage(vg.VGImageFormat.VG_sARGB_8888, this.width, this.height, vg.VGImageQuality.VG_IMAGE_QUALITY_BETTER);
    vg.imageSubData(this._handle, this.data, -this.width * 4, vg.VGImageFormat.VG_sARGB_8888, 0, 0, this.width, this.height); // sx, sy, w, h
};

Image.prototype.getHandle = function () {
    if (!this._handle) this.upload();
    return this._handle;
};

Image.prototype.destroy = function () {
    MemoryManager.remove( this._memoryManagerIndex );
    imageFinalizer.call(this);
};

Image.drawImage = function (img, sx, sy, sw, sh, dx, dy, dw, dh, paintFn) {
    var mm = m.create();

    vg.getMatrix(mm);

    var savMatrixMode = vg.getI(vg.VGParamType.VG_MATRIX_MODE);
    vg.setI(vg.VGParamType.VG_MATRIX_MODE, vg.VGMatrixMode.VG_MATRIX_IMAGE_USER_TO_SURFACE);

    vg.loadMatrix(mm);
    vg.translate(dx, dy);
    vg.scale(dw / sw, dh / sh);

    vg.setI(vg.VGParamType.VG_IMAGE_MODE, vg.VGImageMode.VG_DRAW_IMAGE_NORMAL);

    if (sx === 0 && sy === 0 && sw === img.width && sh === img.height) {
        paintFn(img.handle);
    } else {
        var vgSubHandle = vg.createImage(vg.VGImageFormat.VG_sARGB_8888, sw, sh, vg.VGImageQuality.VG_IMAGE_QUALITY_BETTER);
        vg.copyImage(vgSubHandle, 0, 0, img.handle, sx, sy, sw, sh, true);
        paintFn(vgSubHandle);
        vg.destroyImage(vgSubHandle);
    }

    vg.setI(vg.VGParamType.VG_MATRIX_MODE, savMatrixMode);
    vg.loadMatrix(mm);
};

module.exports = Image;

function imageFinalizer() {
    if (this.handle) {
        vg.destroyImage(this.handle);
    }
}