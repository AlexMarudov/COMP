var express = require('express');
var http = require('http');
var path = require('path');
var logger = require('morgan');
var methodOverride = require('method-override');
var session = require('express-session');
var bodyParser = require('body-parser');
var multer = require('multer');

//*
var passport = require('passport');
var Sequelize = require("sequelize");
var passportLocalSequelize = require('passport-local-sequelize');
var cookieParser = require('cookie-parser');
//*

var child_process = require('child_process');

var app = express();

//*
//SQLite
// Подключаемся к базе
var mydb = new Sequelize('database', 'username', 'password', {
  dialect: 'sqlite',
  storage: 'database.sqlite'
});

// Модель пользователя
var User = passportLocalSequelize.defineUser(mydb, {
    admin: {
      type: Sequelize.BOOLEAN,
      defaultValue: function() { return false },
      primaryKey: false,
   }
});
// Создаем таблицу
User.sync();
//

// all environments
app.set('port', process.env.PORT || 3000);

//*
app.set('views', path.join(__dirname, 'views'));
app.engine('html', require('ejs').renderFile);
app.set('view engine', 'ejs');
//

//app.set('view engine', 'html');;
app.use(logger('dev'));
app.use(methodOverride());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, 'public')));

//*
app.use(bodyParser());
app.use(require('connect-multiparty')());
app.use(cookieParser());
app.use(session({ secret: 'super-secret' }));

app.use(passport.initialize());
app.use(passport.session());

passport.use(User.createStrategy());

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

var child = child_process.fork(__dirname + '/child.js');
// var child = child_process.fork(__dirname + '/child-win.js');
var taskId = 0;
var tasks = {};
var maxQueue = 10; // menentukan seberapa banyak queue yang bisa dilayani oleh satu server

function addTask(data, callback) {
    // taskId++;
    // if (taskId > 10) taskId = 1;
    taskId++;
    if (taskId > maxQueue) taskId = 1;

    child.send({
        id: taskId,
        user: data.username,
        script: data.script,
        inputs: data.inputs,
    });

    tasks[taskId] = callback;
}

child.on('message', function(message) {
    // Look up the callback bound to this id and invoke it with the result
    // console.log(message);
    tasks[message.id](message);
});

app.get('/', function(req, res) {
    res.render("login.html");
});

// Регаем пользователя test test
User.register("ALegalov", "12345", function(err, user) {
  if (err) return;
  user.set('admin', true);
  user.save();
});

app.get('/login',
  function(req, res) {
  if (req.isAuthenticated()) {
            if (req.user.admin) {
                res.redirect('/admin');
                return;
            }

            res.redirect('/compile');
            return;
    }
  res.render("login.html");
})


app.post('/login',  function(req, res, next) {
  passport.authenticate('local', function(err, user, info) {
    if (err) return next(err);
    if (!user) {
      res.redirect('/login');
      return;
    }

    req.logIn(user, function(logErr) {
      if (logErr) return next(err);
      
      if (user.admin) { 
        res.redirect('/admin');
   	return;
      };

      res.redirect('/compile');
    });
  })(req,res,next);
})

app.get('/register',
	function(req, res) {
	if (req.isAuthenticated()) {
            res.redirect('/compile');
            return;
    }
    res.render("register.html");
})

app.post('/register', function(req, res) {
    if (req.isAuthenticated()) {
            res.redirect('/compile');
            return;
        }
    var user = req.body.username;
    var account = req.body.password;
    User.register(user, account, function(error, user){
        if (error) {
            res.redirect('/register');
            return;
        }

        passport.authenticate('local')(req, res, function () {
            res.redirect('/compile');
        })
    });
});
//

app.get('/logout', function(req, res) {
  req.logout();
  res.redirect('/login');
});


// Админка

var task = "";
var timer;

app.get('/admin',
	function(req, res) {
        if (!req.isAuthenticated()) {
            res.redirect('/login');
            return;
        }

    res.render('admin.html', { user: req.user.username, task: task });
});

app.post('/admin', function(req, res) {
  task = req.body.script;
  timer = req.body.timer;
  res.redirect('/admin');
});


app.get('/compile',
	function(req, res) {
        if (!req.isAuthenticated()) {
            res.redirect('/login');
            return;
        }
	timer--;
    res.render('index.ejs', { user: req.user.username, task: task, timer: timer });

});


app.post('/compile',
	function(req, res) {
        if (!req.isAuthenticated()) {
            res.redirect('/login');
            return;
        }

	//res.header('Access-Control-Allow-Origin', '*');
	var script = req.body.script;
	var inputs = req.body.inputs;
   addTask({script: script, inputs:inputs, username: req.user.username}, function(result) {
        res.json(result);
    });
});
// Filemanager
var cloudcmd    = require('cloudcmd'),
    io          = require('socket.io');

socket = io.listen(server, {
    path: '/filemanager' + '/socket.io'
});

var server = http.createServer(app);


app.use('/filemanager/', cloudcmd({
    socket: socket,     /* used by Config, Edit (optional) and Console (required)   */
    config: {           /* config data (optional)                                   */
	root:	path.join(__dirname, 'users'),  /* root folder*/
	prefix:	'/filemanager', /* base URL or function which returns base URL (optional)   */
	auth              : true,
	username          : "ALegalov",           /* имя пользователя для авторизации                                */
	password          : "8",           /* хеш пароля в sha-1 для авторизации                              */
	}

}));

app.use(function( req, res, next) {
	res.status(404).render("404.html");
	next();
});

server.listen(app.get('port'), function(){
  console.log('compiler active on port ' + app.get('port'));
});
