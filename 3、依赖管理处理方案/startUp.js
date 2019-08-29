(function(global) {
    var startUp = global.startUp = {
        version: "1.0.0"
    }

    function isFunction(fn) {
        return toString.call(fn) === "[object Function]"
    }

    function isString(str){
        return toString.call(str) === "[object String]"
    }

    //是否使用了别名
    function parseAlias(id){
        var alias = data.alias  //配置
        return alias && isString(alias[id]) ? alias[id] : id
    }

    var PATHS_RE = /^([^\/:]+)(\/.+)$/

    //检测是否有 书写路径短名称
    function parsePaths(id){    //a.js, b.js
        
        return id
    }

    //检测是否添加后缀
    function normalize(path){    //a.js, b.js
        var last = path.length - 1
        var lastC = path.charAt(last)
        return (lastC === "/" || path.substring(last - 2) === ".js") ? path : path + ".js"
    }

    function addBase(id, uri) {
        var result
        //相对路径
        if(id.charAt(0) === "."){
            result = realpath((uri ? uri.match(/[^?]*\//)[0] : data.cwd) + id)
        } else {
            result = data.cwd + id
        }
        return result
    }

    var DOT_RE = /\/\.\//g                   //   /a/b/./c/./d ==> /a/b/c/d
    var DOUBLE_DOT_RE = /\/[^/]+\/\.\.\//g   //  /a/b/c/../../d ==? /a/b/../d ==> a/d
    function realpath(path) {
        path = path.replace(DOT_RE, "/")
        while(path.match(DOUBLE_DOT_RE)) {
            path = path.replace(DOUBLE_DOT_RE, "/")
        }
        return path
    }

    //生成绝对路径，
    startUp.resolve = function(child, parent) {
        if(!child) return ''
        child = parseAlias(child)   //检测是否有别名
        child = parsePaths(child)   //检测是否有路径别名，依赖模块中引包的模块路径地址 require("app/c")
        child = normalize(child)    //检测是否添加后缀
        return addBase(child, parent)
    }

    startUp.request = function(url, callback) {
        var node = document.createElement("script")
        node.src = url
        document.body.append(node)
        node.onload = function() {
            node.onload = null
            document.body.removeChild(node)
            callback()
        }
    }

    var data = {},
        anonymousMeta = {},
        cache = {}, //缓存对象，虚拟根目录，键值对的形式，键是模块的绝对路径地址，值为Module对象
        status = {  //模块生命周期，状态码
            FETCHED: 1,         //正在获取当前模块的uri（绝对路径地址）
            SAVED: 2,           //缓存中存储模块数据信息
            LOADING: 3,         //正在加载当前模块依赖项
            LOADED: 4,          //准备执行当前模块 
            EXECUTING: 5,       //正在执行当前模块
            EXECUTED: 6         //执行完毕接口对象
        }
    
    var isArray = function(obj) {
        return toString.call(obj) === "[object Array]"
    }

    //构造函数，模块初始化数据 (uri： 绝对路径)
    function Module(uri, deps) {
        this.uri = uri          //当前模块的绝对路径地址
        this.deps = deps || []  //依赖项 ["a.js", "b.js"]
        this.exports = null     //当前模块对外暴露接口对象
        this.status = 0         //模块状态
        this._waittings = {}    //有多少个依赖项
        this._remain = 0        //还有多少个未加载的依赖项
    }

    //分析主干（左子树 | 右子树）上的依赖项
    Module.prototype.load = function() {
        var m = this
        m.status = status.LOADING
        var uris = m.resolve()  //存储传进来的数据的绝对路径
        var len = m._remain = uris.length

        // 加载主干上的依赖项（模块）
        var seed
        for (var i = 0; i < len; i++) {
            seed = Module.get(uris[i])
            if(seed.status < status.LOADED){
                seed._waittings[m.uri] = seed._waittings[m.uri] || 1
            } else{
                seed._remain--
            }
        }

        //如果依赖列表模块全部加载完毕
        if(m._remain == 0){
            //获取模块的接口对象
            //所有模块加载完毕
            m.onload()
        }

        //准备执行根目录下的依赖列表中的模块
        var requestCache = {}
        for (let i = 0; i < len; i++) {
            seed = Module.get(uris[i])
            if(seed.status < status.FETCHED){
                seed.fetch(requestCache)
            }
        }

        for (uri in requestCache) {
            requestCache[uri]()
        }
    }

    //加载依赖列表中的模块
    Module.prototype.fetch = function(requestCache) {
        var m = this
        m.status = status.FETCHED
        var uri = m.uri //a.js 绝对路径
        requestCache[uri] = sendRequest

        function sendRequest() {
            startUp.request(uri, onRequest) //动态加载script
        }

        function onRequest() {  //事件函数
            if(anonymousMeta){  //模块数据更新
                m.save(uri, anonymousMeta)
            }
            m.load()    //递归
        }
    }

    Module.prototype.onload = function() {
        var mod = this
        mod.status = status.LOADED
        if(mod.callback){
            mod.callback()
        }
        var _waittings = mod._waittings,
            key
        for (key in _waittings) {
            var m = cache[key]
            m._remain -= _waittings[key]
            if(m._remain == 0){
                m.onload()
            }
        }
    }

    //资源定位
    Module.prototype.resolve = function() {
        var mod = this
        var ids = mod.deps  //["a.js", "b.js"]
        var uris = []
        for (var i = 0; i < ids.length; i++) {
            uris[i] = startUp.resolve(ids[i], mod.uri)
        }

        return uris
    }

    Module.prototype.save = function (uri, meta) {
        var mod = Module.get(uri)
        mod.uri = uri
        mod.deps = meta.deps || []
        mod.factory = meta.factory
        mod.status = status.SAVED
    }

    Module.prototype.exec = function() {
        var module = this 

        if(module.status >= status.EXECUTING){
            return module.exports
        }

        module.status = status.EXECUTING
        var uri = module.uri

        function require(id) {
            return Module.get(require.resolve(id).exec())
        }

        require.resolve = function(id) {
            return startUp.resolve(id, uri)
        }

        var factory = module.factory
        var exports = isFunction(factory) ? factory(require, module.exports = {}, module) : factory

        if(exports === undefined){
            exports = module.exports
        }

        module.exports = exports
        module.status = status.EXECUTED
        return exports
    }

    //定义一个模块
    Module.define = function(factory) {
        //提取 正则提取
        var deps
        if(isFunction(factory)){
            deps = parseDependencies(factory.toString())
        }

        var meta = {
            id: '',
            uri: '',
            deps: deps,
            factory: factory
        }
        anonymousMeta = meta
    }

    //检测缓存对象上是否有当前模块信息，有->拿缓存，没有->创建
    Module.get = function(uri, deps) {
        return cache[uri] || (cache [uri] = new Module(uri, deps))
    }

    Module.use = function(deps, callback, uri) {
        var m = Module.get(uri, isArray(deps) ? deps : [deps])
        m.callback = function() {
            var exports = []    //所有依赖项模块的接口对象
            var uris = m.resolve()
            for(var i = 0; i < uris.length; i++){
                exports[i] = cache[uris[i]].exec()
            }
            if(callback){
                callback.apply(global, exports)
            }
        }
        m.load()
    }

    var _cid = 0

    function cid() {
        return _cid++
    }

    data.preload = []

    //获取当前文档的URL
    data.cwd = document.URL.match(/[^?]*\//)[0]
    
    Module.preload = function(callback) {
        var length = data.preload.length
        if(!length){
            callback()
        }
        // length !== 0 先加载预先设定模块
    }

    startUp.use = function(list, callback) {
        //检测有没有预先加载的模块
        Module.preload(function() {
            Module.use(list, callback, data.cwd + "_use_" + cid())
        })
    }
    
    var REQUIRE_RE = /((?<!\/\*.*)(?<!\/\/.*))\brequire\s*\(\s*(["'])(.+?)\2\s*\)(?!\*\/)/g

    function parseDependencies(code) {
        var ret = []
        code.replace(REQUIRE_RE, function(m, m1, m2, m3, m4) {
            if(m2) ret.push(m2)
        })
        return ret
    }
    
    global.define = Module.define
})(this)