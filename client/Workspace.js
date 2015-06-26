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
 */
WebInspector.WorkspaceController = function(workspace)
{
    this._workspace = workspace;
    WebInspector.resourceTreeModel.addEventListener(WebInspector.ResourceTreeModel.EventTypes.InspectedURLChanged, this._inspectedURLChanged, this);
}

WebInspector.WorkspaceController.prototype = {
    /**
     * @param {WebInspector.Event} event
     */
    _inspectedURLChanged: function(event)
    {
        WebInspector.Revision.filterOutStaleRevisions();
    }
}

/**
 * @constructor
 * @param {string} uri
 * @param {string} originURL
 * @param {string} url
 * @param {WebInspector.ResourceType} contentType
 * @param {boolean} isEditable
 * @param {boolean=} isContentScript
 */
WebInspector.FileDescriptor = function(uri, originURL, url, contentType, isEditable, isContentScript)
{
    this.uri = uri;
    this.originURL = originURL;
    this.url = url;
    this.contentType = contentType;
    this.isEditable = isEditable;
    this.isContentScript = isContentScript || false;
}

/**
 * @interface
 */
WebInspector.WorkspaceProvider = function() { }

WebInspector.WorkspaceProvider.Events = {
    FileAdded: "FileAdded",
    FileRemoved: "FileRemoved",
    Reset: "Reset",
}

WebInspector.WorkspaceProvider.prototype = {
    /**
     * @return {string}
     */
    type: function() { },

    /**
     * @param {string} uri
     * @param {function(?string,boolean,string)} callback
     */
    requestFileContent: function(uri, callback) { },

    /**
     * @param {string} uri
     * @param {string} newContent
     * @param {function(?string)} callback
     */
    setFileContent: function(uri, newContent, callback) { },

    /**
     * @param {string} uri
     * @param {string} query
     * @param {boolean} caseSensitive
     * @param {boolean} isRegex
     * @param {function(Array.<WebInspector.ContentProvider.SearchMatch>)} callback
     */
    searchInFileContent: function(uri, query, caseSensitive, isRegex, callback) { },

    /**
     * @param {string} eventType
     * @param {function(WebInspector.Event)} listener
     * @param {Object=} thisObject
     */
    addEventListener: function(eventType, listener, thisObject) { },

    /**
     * @param {string} eventType
     * @param {function(WebInspector.Event)} listener
     * @param {Object=} thisObject
     */
    removeEventListener: function(eventType, listener, thisObject) { }
}

/**
 * @type {?WebInspector.WorkspaceController}
 */
WebInspector.workspaceController = null;

/**
 * @param {WebInspector.Workspace} workspace
 * @param {string} name
 * @param {WebInspector.WorkspaceProvider} workspaceProvider
 * @constructor
 */
WebInspector.Project = function(workspace, name, workspaceProvider)
{
    this._name = name;
    /** @type {Object.<string, WebInspector.UISourceCode>} */
    this._uiSourceCodesForURI = {};
    this._workspace = workspace;
    this._workspaceProvider = workspaceProvider;
    this._workspaceProvider.addEventListener(WebInspector.WorkspaceProvider.Events.FileAdded, this._fileAdded, this);
    this._workspaceProvider.addEventListener(WebInspector.WorkspaceProvider.Events.FileRemoved, this._fileRemoved, this);
    this._workspaceProvider.addEventListener(WebInspector.WorkspaceProvider.Events.Reset, this._reset, this);
}

WebInspector.Project.prototype = {
    /**
     * @return {string}
     */
    name: function()
    {
        return this._name;
    },

    /**
     * @return {string}
     */
    type: function()
    {
        return this._workspaceProvider.type();
    },

    /**
     * @return {boolean}
     */
    isServiceProject: function()
    {
        return this._workspaceProvider.type() === WebInspector.projectTypes.Debugger || this._workspaceProvider.type() === WebInspector.projectTypes.LiveEdit;
    },

    _fileAdded: function(event)
    {
        var fileDescriptor = /** @type {WebInspector.FileDescriptor} */ (event.data);
        var uiSourceCode = this.uiSourceCodeForURI(fileDescriptor.uri);
        if (uiSourceCode) {
            // FIXME: Implement
            return;
        }
        uiSourceCode = new WebInspector.UISourceCode(this, fileDescriptor.uri, fileDescriptor.originURL, fileDescriptor.url, fileDescriptor.contentType, fileDescriptor.isEditable);
        uiSourceCode.isContentScript = fileDescriptor.isContentScript;
        this._uiSourceCodesForURI[uiSourceCode.uri()] = uiSourceCode;
        this._workspace.dispatchEventToListeners(WebInspector.UISourceCodeProvider.Events.UISourceCodeAdded, uiSourceCode);
    },

    _fileRemoved: function(event)
    {
        var uri = /** @type {string} */ (event.data);
        var uiSourceCode = this.uiSourceCodeForURI(uri);
        if (!uiSourceCode)
            return;
        delete this._uiSourceCodesForURI[uiSourceCode.uri()];
        this._workspace.dispatchEventToListeners(WebInspector.UISourceCodeProvider.Events.UISourceCodeRemoved, uiSourceCode);
    },

    _reset: function()
    {
        this._workspace.dispatchEventToListeners(WebInspector.Workspace.Events.ProjectWillReset, this);
        this._uiSourceCodesForURI = {};
    },

    /**
     * @param {string} originURL
     * @return {?WebInspector.UISourceCode}
     */
    uiSourceCodeForOriginURL: function(originURL)
    {
        for (var uri in this._uiSourceCodesForURI) {
            var uiSourceCode = this._uiSourceCodesForURI[uri];
            if (uiSourceCode.originURL() === originURL)
                return uiSourceCode;
        }
        return null;
    },

    /**
     * @param {string} uri
     * @return {?WebInspector.UISourceCode}
     */
    uiSourceCodeForURI: function(uri)
    {
        return this._uiSourceCodesForURI[uri];
    },

    /**
     * @return {Array.<WebInspector.UISourceCode>}
     */
    uiSourceCodes: function()
    {
        return Object.values(this._uiSourceCodesForURI);
    },

    /**
     * @param {WebInspector.UISourceCode} uiSourceCode
     * @param {function(?string,boolean,string)} callback
     */
    requestFileContent: function(uiSourceCode, callback)
    {
        this._workspaceProvider.requestFileContent(uiSourceCode.uri(), callback);
    },

    /**
     * @param {WebInspector.UISourceCode} uiSourceCode
     * @param {string} newContent
     * @param {function(?string)} callback
     */
    setFileContent: function(uiSourceCode, newContent, callback)
    {
        this._workspaceProvider.setFileContent(uiSourceCode.uri(), newContent, callback);
        this._workspace.dispatchEventToListeners(WebInspector.Workspace.Events.UISourceCodeContentCommitted, { uiSourceCode: uiSourceCode, content: newContent });
    },

    /**
     * @param {WebInspector.UISourceCode} uiSourceCode
     * @param {string} query
     * @param {boolean} caseSensitive
     * @param {boolean} isRegex
     * @param {function(Array.<WebInspector.ContentProvider.SearchMatch>)} callback
     */
    searchInFileContent: function(uiSourceCode, query, caseSensitive, isRegex, callback)
    {
        this._workspaceProvider.searchInFileContent(uiSourceCode.uri(), query, caseSensitive, isRegex, callback);
    },

    dispose: function()
    {
        this._workspaceProvider.reset();
    }
}

WebInspector.projectTypes = {
    Debugger: "debugger",
    LiveEdit: "liveedit",
    Compiler: "compiler",
    Network: "network",
    Snippets: "snippets",
    FileSystem: "filesystem"
}

/**
 * @constructor
 * @implements {WebInspector.UISourceCodeProvider}
 * @extends {WebInspector.Object}
 */
WebInspector.Workspace = function()
{
    /** @type {!Object.<string, WebInspector.Project>} */
    this._projects = {};
}

WebInspector.Workspace.Events = {
    UISourceCodeContentCommitted: "UISourceCodeContentCommitted",
    ProjectWillReset: "ProjectWillReset"
}

WebInspector.Workspace.prototype = {
    /**
     * @param {string} originURL
     * @return {?WebInspector.UISourceCode}
     */
    uiSourceCodeForOriginURL: function(originURL)
    {
        var networkProjects = this.projectsForType(WebInspector.projectTypes.Network)
        for (var i = 0; i < networkProjects.length; ++i) {
            var project = networkProjects[i];
            var uiSourceCode = project.uiSourceCodeForOriginURL(originURL);
            if (uiSourceCode)
                return uiSourceCode;
        }
        return null;
    },

    /**
     * @param {string} uri
     * @return {?WebInspector.UISourceCode}
     */
    uiSourceCodeForURI: function(uri)
    {
        for (var projectName in this._projects) {
            var project = this._projects[projectName];
            var uiSourceCode = project.uiSourceCodeForURI(uri);
            if (uiSourceCode)
                return uiSourceCode;
        }
        return null;
    },

    /**
     * @param {string} type
     * @return {Array.<WebInspector.UISourceCode>}
     */
    uiSourceCodesForProjectType: function(type)
    {
        var result = [];
        for (var projectName in this._projects) {
            var project = this._projects[projectName];
            if (project.type() === type)
                result = result.concat(project.uiSourceCodes());
        }
        return result;
    },

    /**
     * @param {string} projectName
     * @param {WebInspector.WorkspaceProvider} workspaceProvider
     * @return {WebInspector.Project}
     */
    addProject: function(projectName, workspaceProvider)
    {
        this._projects[projectName] = new WebInspector.Project(this, projectName, workspaceProvider);
        return this._projects[projectName];
    },

    /**
     * @param {string} projectName
     */
    removeProject: function(projectName)
    {
        var project = this._projects[projectName];
        if (!project)
            return;
        project.dispose();
        delete this._projects[projectName];
    },

    /**
     * @param {string} projectName
     * @return {WebInspector.Project}
     */
    project: function(projectName)
    {
        return this._projects[projectName];
    },

    /**
     * @return {Array.<WebInspector.Project>}
     */
    projects: function()
    {
        return Object.values(this._projects);
    },

    /**
     * @param {string} type
     * @return {Array.<WebInspector.Project>}
     */
    projectsForType: function(type)
    {
        function filterByType(project)
        {
            return project.type() === type;
        }
        return this.projects().filter(filterByType);
    },

    /**
     * @return {Array.<WebInspector.UISourceCode>}
     */
    uiSourceCodes: function()
    {
        var result = [];
        for (var projectName in this._projects) {
            var project = this._projects[projectName];
            result = result.concat(project.uiSourceCodes());
        }
        return result;
    },

    /**
     * @return {?WebInspector.Project}
     */
    projectForUISourceCode: function(uiSourceCode)
    {
        for (var projectName in this._projects) {
            var project = this._projects[projectName];
            if (project.uiSourceCodeForURI(uiSourceCode.uri()))
                return project;
        }
        return null;
    },

    __proto__: WebInspector.Object.prototype
}

/**
 * @type {?WebInspector.Workspace}
 */
WebInspector.workspace = null;
