/*
 * Copyright (C) 2009 Apple Inc.  All rights reserved.
 * Copyright (C) 2009 Joseph Pecoraro
 * Copyright (C) 2010 Google Inc. All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions
 * are met:
 *
 * 1.  Redistributions of source code must retain the above copyright
 *     notice, this list of conditions and the following disclaimer.
 * 2.  Redistributions in binary form must reproduce the above copyright
 *     notice, this list of conditions and the following disclaimer in the
 *     documentation and/or other materials provided with the distribution.
 * 3.  Neither the name of Apple Computer, Inc. ("Apple") nor the names of
 *     its contributors may be used to endorse or promote products derived
 *     from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY APPLE AND ITS CONTRIBUTORS "AS IS" AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL APPLE OR ITS CONTRIBUTORS BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
 * THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

/**
 * @constructor
 * @extends {WebInspector.View}
 * @param {boolean} expandable
 * @param {function(!WebInspector.Cookie)=} deleteCallback
 * @param {function()=} refreshCallback
 */
WebInspector.CookiesTable = function(expandable, deleteCallback, refreshCallback)
{
    WebInspector.View.call(this);
    this.element.className = "fill";

    var columns = {name: {}, value: {}, domain: {}, path: {}, expires: {}, size: {}, httpOnly: {}, secure: {}};
    columns.name.title = WebInspector.UIString("Name");
    columns.name.sortable = true;
    columns.name.disclosure = expandable;
    columns.name.width = "24%";
    columns.name.sort = "ascending";
    columns.value.title = WebInspector.UIString("Value");
    columns.value.sortable = true;
    columns.value.width = "34%";
    columns.domain.title = WebInspector.UIString("Domain");
    columns.domain.sortable = true;
    columns.domain.width = "7%";
    columns.path.title = WebInspector.UIString("Path");
    columns.path.sortable = true;
    columns.path.width = "7%";
    columns.expires.title = WebInspector.UIString("Expires / Max-Age");
    columns.expires.sortable = true;
    columns.expires.width = "7%";
    columns.size.title = WebInspector.UIString("Size");
    columns.size.aligned = "right";
    columns.size.sortable = true;
    columns.size.width = "7%";
    columns.httpOnly.title = WebInspector.UIString("HTTP");
    columns.httpOnly.aligned = "centered";
    columns.httpOnly.sortable = true;
    columns.httpOnly.width = "7%";
    columns.secure.title = WebInspector.UIString("Secure");
    columns.secure.aligned = "centered";
    columns.secure.sortable = true;
    columns.secure.width = "7%";

    this._dataGrid = new WebInspector.DataGrid(columns, undefined, deleteCallback ? this._onDeleteFromGrid.bind(this, deleteCallback) : undefined);
    this._dataGrid.addEventListener("sorting changed", this._rebuildTable, this);
    this._dataGrid.refreshCallback = refreshCallback;

    this._nextSelectedCookie = /** @type {?WebInspector.Cookie} */ (null);

    this._dataGrid.show(this.element);
    this._data = [];
}

WebInspector.CookiesTable.prototype = {
    updateWidths: function()
    {
        if (this._dataGrid)
            this._dataGrid.updateWidths();
    },

    /*
     * @param {!Array.<!WebInspector.Cookie>} cookies
     */
    setCookies: function(cookies)
    {
        this.setCookieFolders([{cookies: cookies}]);
    },

    /**
     * @param {!Array.<!{folderName: ?string, cookies: !Array.<!WebInspector.Cookie>}>} cookieFolders
     */
    setCookieFolders: function(cookieFolders)
    {
        this._data = cookieFolders;
        this._rebuildTable();
    },

    /**
     * @return {?WebInspector.Cookie}
     */
    selectedCookie: function()
    {
        var node = this._dataGrid.selectedNode;
        return node ? node.cookie : null;
    },

    _rebuildTable: function()
    {
        var selectedCookie = this._nextSelectedCookie || this.selectedCookie();
        this._nextSelectedCookie = null;
        this._dataGrid.rootNode().removeChildren();
        for (var i = 0; i < this._data.length; ++i) {
            var item = this._data[i];
            if (item.folderName) {
                var groupData = {name: item.folderName, value: "", domain: "", path: "", expires: "", size: this._totalSize(item.cookies), httpOnly: "", secure: ""};
                var groupNode = new WebInspector.DataGridNode(groupData);
                groupNode.selectable = true;
                this._dataGrid.rootNode().appendChild(groupNode);
                groupNode.element.addStyleClass("row-group");
                this._populateNode(groupNode, item.cookies, selectedCookie);
                groupNode.expand();
            } else
                this._populateNode(this._dataGrid.rootNode(), item.cookies, selectedCookie);
        }
    },

    /**
     * @param {!WebInspector.DataGridNode} parentNode
     * @param {?Array.<!WebInspector.Cookie>} cookies
     * @param {?WebInspector.Cookie} selectedCookie
     */
    _populateNode: function(parentNode, cookies, selectedCookie)
    {
        parentNode.removeChildren();
        if (!cookies)
            return;

        this._sortCookies(cookies);
        for (var i = 0; i < cookies.length; ++i) {
            var cookie = cookies[i];
            var cookieNode = this._createGridNode(cookie);
            parentNode.appendChild(cookieNode);
            if (selectedCookie && selectedCookie.name() === cookie.name() && selectedCookie.domain() === cookie.domain() && selectedCookie.path() === cookie.path())
                cookieNode.select();
        }
    },

    _totalSize: function(cookies)
    {
        var totalSize = 0;
        for (var i = 0; cookies && i < cookies.length; ++i)
            totalSize += cookies[i].size();
        return totalSize;
    },

    /**
     * @param {!Array.<!WebInspector.Cookie>} cookies
     */
    _sortCookies: function(cookies)
    {
        var sortDirection = this._dataGrid.sortOrder === "ascending" ? 1 : -1;

        function compareTo(getter, cookie1, cookie2)
        {
            return sortDirection * (getter.apply(cookie1) + "").compareTo(getter.apply(cookie2) + "")
        }

        function numberCompare(getter, cookie1, cookie2)
        {
            return sortDirection * (getter.apply(cookie1) - getter.apply(cookie2));
        }

        function expiresCompare(cookie1, cookie2)
        {
            if (cookie1.session() !== cookie2.session())
                return sortDirection * (cookie1.session() ? 1 : -1);

            if (cookie1.session())
                return 0;

            if (cookie1.maxAge() && cookie2.maxAge())
                return sortDirection * (cookie1.maxAge() - cookie2.maxAge());
            if (cookie1.expires() && cookie2.expires())
                return sortDirection * (cookie1.expires() - cookie2.expires());
            return sortDirection * (cookie1.expires() ? 1 : -1);
        }

        var comparator;
        switch (this._dataGrid.sortColumnIdentifier) {
            case "name": comparator = compareTo.bind(null, WebInspector.Cookie.prototype.name); break;
            case "value": comparator = compareTo.bind(null, WebInspector.Cookie.prototype.value); break;
            case "domain": comparator = compareTo.bind(null, WebInspector.Cookie.prototype.domain); break;
            case "path": comparator = compareTo.bind(null, WebInspector.Cookie.prototype.path); break;
            case "expires": comparator = expiresCompare; break;
            case "size": comparator = numberCompare.bind(null, WebInspector.Cookie.prototype.size); break;
            case "httpOnly": comparator = compareTo.bind(null, WebInspector.Cookie.prototype.httpOnly); break;
            case "secure": comparator = compareTo.bind(null, WebInspector.Cookie.prototype.secure); break;
            default: compareTo.bind(null, WebInspector.Cookie.prototype.name);
        }

        cookies.sort(comparator);
    },

    /**
     * @param {!WebInspector.Cookie} cookie
     * @return {!WebInspector.DataGridNode}
     */
    _createGridNode: function(cookie)
    {
        var data = {};
        data.name = cookie.name();
        data.value = cookie.value();
        data.domain = cookie.domain() || "";
        data.path = cookie.path() || "";
        if (cookie.type() === WebInspector.Cookie.Type.Request)
            data.expires = "";
        else if (cookie.maxAge())
            data.expires = Number.secondsToString(parseInt(cookie.maxAge(), 10));
        else if (cookie.expires())
            data.expires = new Date(cookie.expires()).toGMTString();
        else
            data.expires = WebInspector.UIString("Session");
        data.size = cookie.size();
        const checkmark = "\u2713";
        data.httpOnly = (cookie.httpOnly() ? checkmark : "");
        data.secure = (cookie.secure() ? checkmark : "");

        var node = new WebInspector.DataGridNode(data);
        node.cookie = cookie;
        node.selectable = true;
        return node;
    },

    _onDeleteFromGrid: function(deleteCallback, node)
    {
        var cookie = node.cookie;
        var neighbour = node.traverseNextNode() || node.traversePreviousNode();
        if (neighbour)
            this._nextSelectedCookie = neighbour.cookie;
        deleteCallback(cookie);
    },

    __proto__: WebInspector.View.prototype
}
