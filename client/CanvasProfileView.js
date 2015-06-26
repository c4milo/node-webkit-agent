/*
 * Copyright (C) 2012 Google Inc. All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are
 * met:
 *
 *     * Redistributions of source code must retain the above copyright
 * notice, this list of conditions and the following disclaimer.
 *     * Redistributions in binary form must reproduce the above
 * copyright notice, this list of conditions and the following disclaimer
 * in the documentation and/or other materials provided with the
 * distribution.
 *     * Neither the name of Google Inc. nor the names of its
 * contributors may be used to endorse or promote products derived from
 * this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
 * LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
 * A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
 * OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
 * LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
 * DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
 * THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

/**
 * @constructor
 * @extends {WebInspector.View}
 * @param {!WebInspector.CanvasProfileHeader} profile
 */
WebInspector.CanvasProfileView = function(profile)
{
    WebInspector.View.call(this);
    this.registerRequiredCSS("canvasProfiler.css");
    this._profile = profile;
    this._traceLogId = profile.traceLogId();
    this.element.addStyleClass("canvas-profile-view");

    this._linkifier = new WebInspector.Linkifier();
    this._splitView = new WebInspector.SplitView(false, "canvasProfileViewSplitLocation", 300);

    var replayImageContainer = this._splitView.firstElement();
    replayImageContainer.id = "canvas-replay-image-container";
    this._replayImageElement = replayImageContainer.createChild("image", "canvas-replay-image");
    this._debugInfoElement = replayImageContainer.createChild("div");

    var replayInfoContainer = this._splitView.secondElement();
    var controlsContainer = replayInfoContainer.createChild("div", "status-bar");
    var logGridContainer = replayInfoContainer.createChild("div", "canvas-replay-log");

    this._createControlButton(controlsContainer, "canvas-replay-first-step", WebInspector.UIString("First call."), this._onReplayFirstStepClick.bind(this));
    this._createControlButton(controlsContainer, "canvas-replay-prev-step", WebInspector.UIString("Previous call."), this._onReplayStepClick.bind(this, false));
    this._createControlButton(controlsContainer, "canvas-replay-next-step", WebInspector.UIString("Next call."), this._onReplayStepClick.bind(this, true));
    this._createControlButton(controlsContainer, "canvas-replay-prev-draw", WebInspector.UIString("Previous drawing call."), this._onReplayDrawingCallClick.bind(this, false));
    this._createControlButton(controlsContainer, "canvas-replay-next-draw", WebInspector.UIString("Next drawing call."), this._onReplayDrawingCallClick.bind(this, true));
    this._createControlButton(controlsContainer, "canvas-replay-last-step", WebInspector.UIString("Last call."), this._onReplayLastStepClick.bind(this));

    this._replayContextSelector = new WebInspector.StatusBarComboBox(this._onReplayContextChanged.bind(this));
    this._replayContextSelector.createOption("<screenshot auto>", WebInspector.UIString("Show screenshot of the last replayed resource."), "");
    controlsContainer.appendChild(this._replayContextSelector.element);

    /** @type {!Object.<string, boolean>} */
    this._replayContexts = {};
    /** @type {!Object.<string, CanvasAgent.ResourceState>} */
    this._currentResourceStates = {};

    var columns = { 0: {}, 1: {}, 2: {} };
    columns[0].title = "#";
    columns[0].sortable = true;
    columns[0].width = "5%";
    columns[1].title = WebInspector.UIString("Call");
    columns[1].sortable = true;
    columns[1].width = "75%";
    columns[2].title = WebInspector.UIString("Location");
    columns[2].sortable = true;
    columns[2].width = "20%";

    this._logGrid = new WebInspector.DataGrid(columns);
    this._logGrid.element.addStyleClass("fill");
    this._logGrid.show(logGridContainer);
    this._logGrid.addEventListener(WebInspector.DataGrid.Events.SelectedNode, this._replayTraceLog.bind(this));

    /** @type {!Array.<WebInspector.DataGridNode>} */
    this._logGridNodes = [];

    this._splitView.show(this.element);
    this._requestTraceLog();
}

/**
 * @const
 * @type {number}
 */
WebInspector.CanvasProfileView.TraceLogPollingInterval = 500;

WebInspector.CanvasProfileView.prototype = {
    dispose: function()
    {
        this._logGridNodes = [];
        this._linkifier.reset();
    },

    get statusBarItems()
    {
        return [];
    },

    get profile()
    {
        return this._profile;
    },

    /**
     * @override
     * @return {Array.<Element>}
     */
    elementsToRestoreScrollPositionsFor: function()
    {
        return [this._logGrid.scrollContainer];
    },

    /**
     * @param {Element} parent
     * @param {string} className
     * @param {string} title
     * @param {function(this:WebInspector.CanvasProfileView)} clickCallback
     */
    _createControlButton: function(parent, className, title, clickCallback)
    {
        var button = parent.createChild("button", "status-bar-item");
        button.addStyleClass(className);
        button.title = title;
        button.createChild("img");
        button.addEventListener("click", clickCallback, false);
    },

    _onReplayContextChanged: function()
    {
        /**
         * @param {?Protocol.Error} error
         * @param {CanvasAgent.ResourceState} resourceState
         */
        function didReceiveResourceState(error, resourceState)
        {
            this._enableWaitIcon(false);
            if (error)
                return;

            this._currentResourceStates[resourceState.id] = resourceState;

            var selectedContextId = this._replayContextSelector.selectedOption().value;
            if (selectedContextId === resourceState.id)
                this._replayImageElement.src = resourceState.imageURL;
        }

        var selectedContextId = this._replayContextSelector.selectedOption().value || "auto";
        var resourceState = this._currentResourceStates[selectedContextId];
        if (resourceState)
            this._replayImageElement.src = resourceState.imageURL;
        else {
            this._enableWaitIcon(true);
            this._replayImageElement.src = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=="; // Empty transparent image.
            CanvasAgent.getResourceState(this._traceLogId, selectedContextId, didReceiveResourceState.bind(this));
        }
    },

    /**
     * @param {boolean} forward
     */
    _onReplayStepClick: function(forward)
    {
        var selectedNode = this._logGrid.selectedNode;
        if (!selectedNode)
            return;
        var nextNode = forward ? selectedNode.traverseNextNode(false) : selectedNode.traversePreviousNode(false);
        if (nextNode)
            nextNode.revealAndSelect();
        else
            selectedNode.reveal();
    },

    /**
     * @param {boolean} forward
     */
    _onReplayDrawingCallClick: function(forward)
    {
        var callNode = this._logGrid.selectedNode;
        if (!callNode)
            return;
        var index = callNode.index;
        do {
            var nextIndex = forward ? index + 1 : index - 1;
            var nextCallNode = this._logGridNodes[nextIndex];
            if (!nextCallNode)
                break;
            index = nextIndex;
            callNode = nextCallNode;
        } while (!callNode.call.isDrawingCall);
        callNode.revealAndSelect();
    },

    _onReplayFirstStepClick: function()
    {
        var firstNode = this._logGrid.rootNode().children[0];
        if (firstNode)
            firstNode.revealAndSelect();
    },

    _onReplayLastStepClick: function()
    {
        var children = this._logGrid.rootNode().children;
        var lastNode = children[children.length - 1];
        if (lastNode)
            lastNode.revealAndSelect();
    },

    /**
     * @param {boolean} enable
     */
    _enableWaitIcon: function(enable)
    {
        function showWaitIcon()
        {
            this._replayImageElement.addStyleClass("wait");
            this._debugInfoElement.addStyleClass("hidden");
            delete this._showWaitIconTimer;
        }

        if (enable && this._replayImageElement.src && !this._showWaitIconTimer)
            this._showWaitIconTimer = setTimeout(showWaitIcon.bind(this), 250);
        else {
            if (this._showWaitIconTimer) {
                clearTimeout(this._showWaitIconTimer);
                delete this._showWaitIconTimer;
            }
            this._replayImageElement.enableStyleClass("wait", enable);
            this._debugInfoElement.enableStyleClass("hidden", enable);
        }
    },

    _replayTraceLog: function()
    {
        var callNode = this._logGrid.selectedNode;
        if (!callNode)
            return;
        var time = Date.now();
        /**
         * @param {?Protocol.Error} error
         * @param {CanvasAgent.ResourceState} resourceState
         */
        function didReplayTraceLog(error, resourceState)
        {
            if (callNode !== this._logGrid.selectedNode)
                return;

            this._enableWaitIcon(false);
            if (error)
                return;

            this._currentResourceStates = {};
            this._currentResourceStates["auto"] = resourceState;
            this._currentResourceStates[resourceState.id] = resourceState;

            this._debugInfoElement.textContent = "Replay time: " + (Date.now() - time) + "ms";
            this._onReplayContextChanged();
        }
        this._enableWaitIcon(true);
        CanvasAgent.replayTraceLog(this._traceLogId, callNode.index, didReplayTraceLog.bind(this));
    },

    /**
     * @param {?Protocol.Error} error
     * @param {CanvasAgent.TraceLog} traceLog
     */
    _didReceiveTraceLog: function(error, traceLog)
    {
        this._enableWaitIcon(false);
        if (error || !traceLog)
            return;
        var lastNode = null;
        var calls = traceLog.calls;
        for (var i = 0, n = calls.length; i < n; ++i) {
            var call = calls[i];
            this._requestReplayContextInfo(call.contextId);
            var index = traceLog.startOffset + i;
            var gridNode = this._createCallNode(index, call);
            this._logGrid.rootNode().appendChild(gridNode);
            lastNode = gridNode;
        }
        if (lastNode)
            lastNode.revealAndSelect();
        if (traceLog.alive)
            setTimeout(this._requestTraceLog.bind(this), WebInspector.CanvasProfileView.TraceLogPollingInterval);
        this._profile._updateCapturingStatus(traceLog);
    },

    _requestTraceLog: function()
    {
        this._enableWaitIcon(true);
        CanvasAgent.getTraceLog(this._traceLogId, this._logGridNodes.length, undefined, this._didReceiveTraceLog.bind(this));
    },

    /**
     * @param {string} contextId
     */
    _requestReplayContextInfo: function(contextId)
    {
        if (this._replayContexts[contextId])
            return;
        this._replayContexts[contextId] = true;
        /**
         * @param {?Protocol.Error} error
         * @param {CanvasAgent.ResourceInfo} resourceInfo
         */
        function didReceiveResourceInfo(error, resourceInfo)
        {
            if (error) {
                delete this._replayContexts[contextId];
                return;
            }
            this._replayContextSelector.createOption(resourceInfo.description, WebInspector.UIString("Show screenshot of this context's canvas."), contextId);
        }
        CanvasAgent.getResourceInfo(contextId, didReceiveResourceInfo.bind(this));
    },

    /**
     * @param {number} index
     * @param {CanvasAgent.Call} call
     * @return {!WebInspector.DataGridNode}
     */
    _createCallNode: function(index, call)
    {
        var data = {};
        data[0] = index + 1;
        data[1] = call.functionName || "context." + call.property;
        data[2] = "";
        if (call.sourceURL) {
            // FIXME(62725): stack trace line/column numbers are one-based.
            var lineNumber = Math.max(0, call.lineNumber - 1) || 0;
            var columnNumber = Math.max(0, call.columnNumber - 1) || 0;
            data[2] = this._linkifier.linkifyLocation(call.sourceURL, lineNumber, columnNumber);
        }

        if (call.arguments) {
            var args = call.arguments.map(function(argument) {
                return argument.description;
            });
            data[1] += "(" + args.join(", ") + ")";
        } else
            data[1] += " = " + call.value.description;

        if (typeof call.result !== "undefined")
            data[1] += " => " + call.result.description;

        var node = new WebInspector.DataGridNode(data);
        node.index = index;
        node.selectable = true;
        node.call = call;
        this._logGridNodes[index] = node;
        return node;
    },

    __proto__: WebInspector.View.prototype
}

/**
 * @constructor
 * @extends {WebInspector.ProfileType}
 */
WebInspector.CanvasProfileType = function()
{
    WebInspector.ProfileType.call(this, WebInspector.CanvasProfileType.TypeId, WebInspector.UIString("Capture Canvas Frame"));
    this._nextProfileUid = 1;
    this._recording = false;
    this._lastProfileHeader = null;

    this._capturingModeSelector = new WebInspector.StatusBarComboBox(this._dispatchViewUpdatedEvent.bind(this));
    this._capturingModeSelector.element.title = WebInspector.UIString("Canvas capture mode.");
    this._capturingModeSelector.createOption(WebInspector.UIString("Single Frame"), WebInspector.UIString("Capture a single canvas frame."), "");
    this._capturingModeSelector.createOption(WebInspector.UIString("Consecutive Frames"), WebInspector.UIString("Capture consecutive canvas frames."), "1");

    /** @type {!Object.<string, Element>} */
    this._frameOptions = {};

    /** @type {!Object.<string, boolean>} */
    this._framesWithCanvases = {};

    this._frameSelector = new WebInspector.StatusBarComboBox(this._dispatchViewUpdatedEvent.bind(this));
    this._frameSelector.element.title = WebInspector.UIString("Frame containing the canvases to capture.");
    this._frameSelector.element.addStyleClass("hidden");
    WebInspector.runtimeModel.contextLists().forEach(this._addFrame, this);
    WebInspector.runtimeModel.addEventListener(WebInspector.RuntimeModel.Events.FrameExecutionContextListAdded, this._frameAdded, this);
    WebInspector.runtimeModel.addEventListener(WebInspector.RuntimeModel.Events.FrameExecutionContextListRemoved, this._frameRemoved, this);

    this._decorationElement = document.createElement("div");
    this._decorationElement.addStyleClass("profile-canvas-decoration");
    this._decorationElement.addStyleClass("hidden");
    this._decorationElement.textContent = WebInspector.UIString("There is an uninstrumented canvas on the page. Reload the page to instrument it.");
    var reloadPageButton = this._decorationElement.createChild("button");
    reloadPageButton.type = "button";
    reloadPageButton.textContent = WebInspector.UIString("Reload");
    reloadPageButton.addEventListener("click", this._onReloadPageButtonClick.bind(this), false);

    this._dispatcher = new WebInspector.CanvasDispatcher(this);

    // FIXME: enable/disable by a UI action?
    CanvasAgent.enable(this._updateDecorationElement.bind(this));
    WebInspector.resourceTreeModel.addEventListener(WebInspector.ResourceTreeModel.EventTypes.MainFrameNavigated, this._updateDecorationElement, this);
}

WebInspector.CanvasProfileType.TypeId = "CANVAS_PROFILE";

WebInspector.CanvasProfileType.prototype = {
    get statusBarItems()
    {
        return [this._capturingModeSelector.element, this._frameSelector.element];
    },

    get buttonTooltip()
    {
        if (this._isSingleFrameMode())
            return WebInspector.UIString("Capture next canvas frame.");
        else
            return this._recording ? WebInspector.UIString("Stop capturing canvas frames.") : WebInspector.UIString("Start capturing canvas frames.");
    },

    /**
     * @override
     * @param {WebInspector.ProfilesPanel} profilesPanel
     * @return {boolean}
     */
    buttonClicked: function(profilesPanel)
    {
        if (this._recording) {
            this._recording = false;
            this._stopFrameCapturing();
        } else if (this._isSingleFrameMode()) {
            this._recording = false;
            this._runSingleFrameCapturing(profilesPanel);
        } else {
            this._recording = true;
            this._startFrameCapturing(profilesPanel);
        }
        profilesPanel.setRecordingProfile(WebInspector.CanvasProfileType.TypeId, this._recording);
        return this._recording;
    },

    /**
     * @param {WebInspector.ProfilesPanel} profilesPanel
     */
    _runSingleFrameCapturing: function(profilesPanel)
    {
        var frameId = this._selectedFrameId();
        CanvasAgent.captureFrame(frameId, this._didStartCapturingFrame.bind(this, profilesPanel, frameId));
    },

    /**
     * @param {WebInspector.ProfilesPanel} profilesPanel
     */
    _startFrameCapturing: function(profilesPanel)
    {
        var frameId = this._selectedFrameId();
        CanvasAgent.startCapturing(frameId, this._didStartCapturingFrame.bind(this, profilesPanel, frameId));
    },

    _stopFrameCapturing: function()
    {
        if (!this._lastProfileHeader)
            return;
        var profileHeader = this._lastProfileHeader;
        var traceLogId = profileHeader.traceLogId();
        this._lastProfileHeader = null;
        function didStopCapturing()
        {
            profileHeader._updateCapturingStatus();
        }
        CanvasAgent.stopCapturing(traceLogId, didStopCapturing.bind(this));
    },

    /**
     * @param {WebInspector.ProfilesPanel} profilesPanel
     * @param {string|undefined} frameId
     * @param {?Protocol.Error} error
     * @param {CanvasAgent.TraceLogId} traceLogId
     */
    _didStartCapturingFrame: function(profilesPanel, frameId, error, traceLogId)
    {
        if (error || this._lastProfileHeader && this._lastProfileHeader.traceLogId() === traceLogId)
            return;
        var profileHeader = new WebInspector.CanvasProfileHeader(this, WebInspector.UIString("Trace Log %d", this._nextProfileUid), this._nextProfileUid, traceLogId, frameId);
        ++this._nextProfileUid;
        this._lastProfileHeader = profileHeader;
        profilesPanel.addProfileHeader(profileHeader);
        profileHeader._updateCapturingStatus();
    },

    get treeItemTitle()
    {
        return WebInspector.UIString("CANVAS PROFILE");
    },

    get description()
    {
        return WebInspector.UIString("Canvas calls instrumentation");
    },

    /**
     * @override
     * @return {Element}
     */
    decorationElement: function()
    {
        return this._decorationElement;
    },

    /**
     * @override
     */
    reset: function()
    {
        this._nextProfileUid = 1;
    },

    setRecordingProfile: function(isProfiling)
    {
        this._recording = isProfiling;
    },

    /**
     * @override
     * @param {string=} title
     * @return {WebInspector.ProfileHeader}
     */
    createTemporaryProfile: function(title)
    {
        title = title || WebInspector.UIString("Capturing\u2026");
        return new WebInspector.CanvasProfileHeader(this, title);
    },

    /**
     * @override
     * @param {ProfilerAgent.ProfileHeader} profile
     * @return {WebInspector.ProfileHeader}
     */
    createProfile: function(profile)
    {
        return new WebInspector.CanvasProfileHeader(this, profile.title, -1);
    },

    _updateDecorationElement: function()
    {
        /**
         * @param {?Protocol.Error} error
         * @param {boolean} result
         */
        function callback(error, result)
        {
            var hideWarning = (error || !result);
            this._decorationElement.enableStyleClass("hidden", hideWarning);
        }
        CanvasAgent.hasUninstrumentedCanvases(callback.bind(this));
    },

    /**
     * @param {MouseEvent} event
     */
    _onReloadPageButtonClick: function(event)
    {
        PageAgent.reload(event.shiftKey);
    },

    /**
     * @return {boolean}
     */
    _isSingleFrameMode: function()
    {
        return !this._capturingModeSelector.selectedOption().value;
    },

    /**
     * @param {WebInspector.Event} event
     */
    _frameAdded: function(event)
    {
        var contextList = /** @type {WebInspector.FrameExecutionContextList} */ (event.data);
        this._addFrame(contextList);
    },

    /**
     * @param {WebInspector.FrameExecutionContextList} contextList
     */
    _addFrame: function(contextList)
    {
        var frameId = contextList.frameId;
        var option = document.createElement("option");
        option.text = contextList.displayName;
        option.title = contextList.url;
        option.value = frameId;

        this._frameOptions[frameId] = option;

        if (this._framesWithCanvases[frameId]) {
            this._frameSelector.addOption(option);
            this._dispatchViewUpdatedEvent();
        }
    },

    /**
     * @param {WebInspector.Event} event
     */
    _frameRemoved: function(event)
    {
        var contextList = /** @type {WebInspector.FrameExecutionContextList} */ (event.data);
        var frameId = contextList.frameId;
        var option = this._frameOptions[frameId];
        if (option && this._framesWithCanvases[frameId]) {
            this._frameSelector.removeOption(option);
            this._dispatchViewUpdatedEvent();
        }
        delete this._frameOptions[frameId];
        delete this._framesWithCanvases[frameId];
    },

    /**
     * @param {string} frameId
     */
    _contextCreated: function(frameId)
    {
        if (this._framesWithCanvases[frameId])
            return;
        this._framesWithCanvases[frameId] = true;
        var option = this._frameOptions[frameId];
        if (option) {
            this._frameSelector.addOption(option);
            this._dispatchViewUpdatedEvent();
        }
    },

    /**
     * @param {NetworkAgent.FrameId=} frameId
     * @param {CanvasAgent.TraceLogId=} traceLogId
     */
    _traceLogsRemoved: function(frameId, traceLogId)
    {
        var sidebarElementsToDelete = [];
        var sidebarElements = /** @type {!Array.<WebInspector.ProfileSidebarTreeElement>} */ ((this.treeElement && this.treeElement.children) || []);
        for (var i = 0, n = sidebarElements.length; i < n; ++i) {
            var header = /** @type {WebInspector.CanvasProfileHeader} */ (sidebarElements[i].profile);
            if (!header)
                continue;
            if (frameId && frameId !== header.frameId())
                continue;
            if (traceLogId && traceLogId !== header.traceLogId())
                continue;
            sidebarElementsToDelete.push(sidebarElements[i]);
        }
        for (var i = 0, n = sidebarElementsToDelete.length; i < n; ++i)
            sidebarElementsToDelete[i].ondelete();
    },

    /**
     * @return {string|undefined}
     */
    _selectedFrameId: function()
    {
        var option = this._frameSelector.selectedOption();
        return option ? option.value : undefined;
    },

    _dispatchViewUpdatedEvent: function()
    {
        this._frameSelector.element.enableStyleClass("hidden", this._frameSelector.size() <= 1);
        this.dispatchEventToListeners(WebInspector.ProfileType.Events.ViewUpdated);
    },

    __proto__: WebInspector.ProfileType.prototype
}

/**
 * @constructor
 * @implements {CanvasAgent.Dispatcher}
 * @param {WebInspector.CanvasProfileType} profileType
 */
WebInspector.CanvasDispatcher = function(profileType)
{
    this._profileType = profileType;
    InspectorBackend.registerCanvasDispatcher(this);
}

WebInspector.CanvasDispatcher.prototype = {
    /**
     * @param {string} frameId
     */
    contextCreated: function(frameId)
    {
        this._profileType._contextCreated(frameId);
    },

    /**
     * @param {NetworkAgent.FrameId=} frameId
     * @param {CanvasAgent.TraceLogId=} traceLogId
     */
    traceLogsRemoved: function(frameId, traceLogId)
    {
        this._profileType._traceLogsRemoved(frameId, traceLogId);
    }
}

/**
 * @constructor
 * @extends {WebInspector.ProfileHeader}
 * @param {!WebInspector.CanvasProfileType} type
 * @param {string} title
 * @param {number=} uid
 * @param {CanvasAgent.TraceLogId=} traceLogId
 * @param {NetworkAgent.FrameId=} frameId
 */
WebInspector.CanvasProfileHeader = function(type, title, uid, traceLogId, frameId)
{
    WebInspector.ProfileHeader.call(this, type, title, uid);
    /** @type {CanvasAgent.TraceLogId} */
    this._traceLogId = traceLogId || "";
    this._frameId = frameId;
    this._alive = true;
    this._traceLogSize = 0;
}

WebInspector.CanvasProfileHeader.prototype = {
    /**
     * @return {CanvasAgent.TraceLogId}
     */
    traceLogId: function()
    {
        return this._traceLogId;
    },

    /**
     * @return {NetworkAgent.FrameId|undefined}
     */
    frameId: function()
    {
        return this._frameId;
    },

    /**
     * @override
     * @return {WebInspector.ProfileSidebarTreeElement}
     */
    createSidebarTreeElement: function()
    {
        return new WebInspector.ProfileSidebarTreeElement(this, WebInspector.UIString("Trace Log %d"), "profile-sidebar-tree-item");
    },

    /**
     * @override
     * @param {WebInspector.ProfilesPanel} profilesPanel
     */
    createView: function(profilesPanel)
    {
        return new WebInspector.CanvasProfileView(this);
    },

    /**
     * @override
     * @param {!WebInspector.ProfilesPanel} profilesPanel
     */
    dispose: function(profilesPanel)
    {
        if (this._traceLogId) {
            CanvasAgent.dropTraceLog(this._traceLogId);
            clearTimeout(this._requestStatusTimer);
            if (this._alive)
                profilesPanel.setRecordingProfile(WebInspector.CanvasProfileType.TypeId, false);
            this._alive = false;
        }
    },

    /**
     * @param {CanvasAgent.TraceLog=} traceLog
     */
    _updateCapturingStatus: function(traceLog)
    {
        if (!this.sidebarElement || !this._traceLogId)
            return;

        if (traceLog) {
            this._alive = traceLog.alive;
            this._traceLogSize = traceLog.totalAvailableCalls;
        }

        this.sidebarElement.subtitle = this._alive ? WebInspector.UIString("Capturing\u2026 %d calls", this._traceLogSize) : WebInspector.UIString("Captured %d calls", this._traceLogSize);
        this.sidebarElement.wait = this._alive;

        if (this._alive) {
            clearTimeout(this._requestStatusTimer);
            this._requestStatusTimer = setTimeout(this._requestCapturingStatus.bind(this), WebInspector.CanvasProfileView.TraceLogPollingInterval);
        }
    },

    _requestCapturingStatus: function()
    {
        /**
         * @param {?Protocol.Error} error
         * @param {CanvasAgent.TraceLog} traceLog
         */
        function didReceiveTraceLog(error, traceLog)
        {
            if (error)
                return;
            this._alive = traceLog.alive;
            this._traceLogSize = traceLog.totalAvailableCalls;
            this._updateCapturingStatus();
        }
        CanvasAgent.getTraceLog(this._traceLogId, 0, 0, didReceiveTraceLog.bind(this));
    },

    __proto__: WebInspector.ProfileHeader.prototype
}
