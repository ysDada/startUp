(function(global) {
    var startUp = global.startUp = {
        version: "1.0.0"
    }

    var data = {},
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

        m.callback()

        // var uris = m.resolve()
        // var len = m._remain = uris.length
        // 加载主干上的依赖项
    }

    //资源定位
    Module.prototype.resolve = function() {
        
    }

    //定义一个模块
    Module.define = function(factory) {
        
    }

    //检测缓存对象上是否有当前模块信息，有->拿缓存，没有->创建
    Module.get = function(uri, deps) {
        return cache[uri] || (cache [uri] = new Module(uri, deps))
    }

    Module.use = function(deps, callback, uri) {
        var m = Module.get(uri, isArray(deps) ? deps : [deps])
        m.callback = function() {

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
    
    global.define = Module.define
})(this)