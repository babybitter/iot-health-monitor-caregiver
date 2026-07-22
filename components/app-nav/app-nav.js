Component({
  options: {
    addGlobalClass: true
  },

  properties: {
    title: { type: String, value: "" },
    subtitle: { type: String, value: "" },
    back: { type: Boolean, value: false },
    transparent: { type: Boolean, value: false }
  },

  data: {
    statusBarHeight: 0,
    contentHeight: 44,
    totalHeight: 44,
    rightInset: 16
  },

  lifetimes: {
    attached() {
      let statusBarHeight = 0;
      let contentHeight = 44;
      let rightInset = 16;
      try {
        const windowInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
        const menuRect = wx.getMenuButtonBoundingClientRect();
        statusBarHeight = windowInfo.statusBarHeight || 0;
        contentHeight = Math.max(44, (menuRect.top - statusBarHeight) * 2 + menuRect.height);
        rightInset = Math.max(16, windowInfo.windowWidth - menuRect.left + 8);
      } catch (error) {
        statusBarHeight = 20;
      }
      this.setData({
        statusBarHeight,
        contentHeight,
        totalHeight: statusBarHeight + contentHeight,
        rightInset
      });
    }
  },

  methods: {
    goBack() {
      if (this._isNavigatingBack) return;
      this._isNavigatingBack = true;

      const release = () => {
        this._isNavigatingBack = false;
      };
      const returnToWorkbench = () => {
        wx.switchTab({
          url: "/pages/workbench/workbench",
          complete: release
        });
      };
      const pages = getCurrentPages();
      if (pages.length > 1) {
        wx.navigateBack({
          delta: 1,
          fail: returnToWorkbench,
          complete: release
        });
      } else {
        returnToWorkbench();
      }
    }
  }
});
