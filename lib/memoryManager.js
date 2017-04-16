var _ = require('underscore');

var MemoryManager = {
    index: 0,
    loadedImages: {},
    activeImages: 0,

    add: function(imageInstance)
    {
        this.index++;
        this.loadedImages[this.index.toString()] = imageInstance;
        this.activeImages++;
        return this.index;
    },

    remove: function(handle)
    {
        if (this.loadedImages[handle.toString()])
        {
            this.activeImages--;
            delete this.loadedImages[handle.toString()];
        }
    },

    destroyAll: function()
    {
        _.each(this.loadedImages, function(imageInstance) {
            imageInstance.destroy();
        });
    }
};

module.exports = MemoryManager;