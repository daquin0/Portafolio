const express = require('express'), //Agregamos los paquetes de la aplicación de Node.js y modulos
  socket = require('socket.io'),
  mysql = require('mysql');
  cookieParser = require('cookie-parser'),		//Se utiliza para manjear las sesiones
  session = require('express-session');

var app = express(); //Paquetes papt la aplicación del desarrollo web, como sesiones y manejo de solicitudes HTTP
var roomName = '';
const nameBot = "BotChat";

var server = app.listen(3030, function () {		//Indicar que se escucha el puerto, utilizando el puerto 3030 (Lo levantamos)
  console.log("Servidor en marcha, port 3030.");
});

var io = socket(server);

var sessionMiddleware = session({	//Le indicamos a Express que usaremos algunos de sus paquetes
  secret: "keyUltraSecret",
  resave: true,
  saveUninitialized: true
});


io.use(function (socket, next) {			//Pasamos las sesiones con el socket 
  sessionMiddleware(socket.request, socket.request.res, next);
});

app.use(sessionMiddleware);		//Requerimos las funciones de la sesión en app, junto con los sockets
app.use(cookieParser());		//Manejo más facil 

const config = {		//Nos conectamos a nuestra base de datos
  host: "localhost",
  user: "root",
  password: 'password',
  base: "chat"
};

var db = mysql.createConnection({	///Nos conectamos a nuestra base de datos
  host     : 'localhost',
  user     : 'root',
  password : 'password',
  database : 'chat'
});

db.connect(function (err) {		//Verificamos si la base de datos existe y mandamos mesnaje de exito o error
  if (!!err)
  throw err;			//Mensaje error

  console.log('MySQL conectado: ' + config.host + ", usuario: " + config.user + ", Base de datos: " + config.base);
});		//Mensaje exito

app.use(express.static('./'));			//Declaramos que será estatica la raiz

io.on('connection', function (socket) {		//Función para crear la conexión del usuario
  var req = socket.request;

  console.log(req.session);			//Imprime las cookies y busca si existe un user ID

	if(req.session.userID != null ){		//Al iniciar sesión...
		db.query("SELECT * FROM users WHERE id=?", [req.session.userID], function(err, rows, fields){
			console.log('Sesión iniciada con el UserID: ' + req.session.userID + ' Y nombre de usuario: ' + 
					req.session.Username);	//Monstrar mensaje con las propiedades del usuario conectado		
			socket.emit("logged_in", {user: req.session.Username, email: req.session.correo, room: req.session.roomName}); //Manda a llamar los parametros del usuario		
		});
	}else{
		console.log('No hay sesión iniciada');	//Monstrar mennsaje de que no se ha iniciado la sesión
	}

	socket.on("login", function(data){			//Recibir parametros
	  const user = data.user,					
	  pass = data.pass;
	  roomID = data.roomID;
	  roomName = data.roomName;

	  db.query("SELECT * FROM users WHERE Username=?", [user], function(err, rows, fields){	//Buscar usuario en la base de datos si existe entrar, si no mostrar mensaje de error
		  if(rows.length == 0){			//Si la consulta no arroja ningun registro
		  	console.log("El usuario no existe, favor de registrarse!");	//Manda mensaje de que el usuario no existe
		  }else{
		  		console.log(rows);		//Imprime la información del usuario conectado en consola
		  		
		  		const dataUser = rows[0].Username,		//Se crean nuevas variables del usuario
			  	dataPass = rows[0].Password,
				dataCorreo = rows[0].email;

				if(dataPass == null || dataUser == null ){			
				  	socket.emit("error");
				}
				if(user == dataUser && pass == dataPass){
					console.log("Usuario correcto!");		//Monstrar mensaje de verificación
					socket.emit("logged_in", {user: user, email: dataCorreo, room: roomName, roomID: roomID});			//Manda los parametros del usuario
					req.session.userID = rows[0].id;	//Asignamos los parametros en sesión	
					req.session.salaID = rows[0].id;
					req.session.Username = dataUser;
					req.session.correo = dataCorreo;
					req.session.roomID = roomID;
					req.session.roomName = roomName;
					req.session.save();	//Guarda
					socket.join(req.session.roomName); 	//pasamos de nombre de sesion el nombre de la sala (crear sala con join)
					socket.emit('armadoHistorial');
					bottxt('entroSala'); //mandar el parametro especificado
				}else{
				  	socket.emit("invalido");
				}
		  }
	  });
	});
	
	socket.on('historial', function(){
		console.log('Buscando historial de la sala: ' + req.session.roomName);

		db.query('SELECT s.nombre_sala, u.Username, m.mensaje FROM mensajes m INNER JOIN salas s ON s.id = m.sala_id INNER JOIN users u ON u.id = m.user_id WHERE m.sala_id = ' 
		+ req.session.roomID + ' ORDER BY m.id ASC', function(err, rows, fields){
			socket.emit('armadoHistorial', rows);
				});
			});

	//Función para agregar un usuario
	socket.on('addUser', function(data){	//Se reciben los parametros  del nuevo usuario
		const user = data.user,
		pass = data.pass,
		email = data.email;
		
		if(user != "" && pass != "" && email != ""){		//Verificamos que no vengan vacios 
			console.log("Registrando el usuario: " + user);		//Si no estan vacios,agregamos un nuevo usuario en la base de datos
		  	db.query("INSERT INTO users(`Username`, `Password`, `email`) VALUES(?, ?, ?)", [user, pass, email], function(err, result){
			  if(!!err)
			  throw err;

			  console.log(result);		//Imprimimos el resultado

			  console.log('Usuario ' + user + " se dio de alta correctamente!.");	//Mandar mensaje de verificación
			  socket.emit('UsuarioOK');		
			});
		}else{
			socket.emit('vacio');			//Manda a vacío	
		}
	});

	socket.on('cambiodesala', function(data){

		const idSala = data.idSala,
		nombreSala = data.nombreSala;

		socket.leave(req.session.roomName);

		req.session.roomID = idSala;
		req.session.roomName = nombreSala;

		socket.join(req.session.roomName);
		bottxt('cambioSala');
	});



	socket.on('mjsNuevo', function(data){ // Función para crear el mensaje nuevo.
		
		//const sala = 0; // definimos el id de la sala para posterior función.
		
			db.query("INSERT INTO mensajes(`mensaje`, `user_id`, `sala_id`, `fecha`) VALUES(?, ?, ?, CURDATE())", [data, req.session.userID, req.session.roomID], function(err, result){
			  if(!!err)
			  throw err;

			  console.log(result);		//Imprimimos resultado

			  console.log('Mensaje dado de alta correctamente!.');	//Mandar mensaje de verificación
			  
			  		socket.broadcast.to(req.session.roomName).emit('mensaje', {		//Mandamos info a mensaje 
						usuario: req.session.Username,		//Le enviamos quien envió el mensaje 
						mensaje: data
					});
					
					socket.emit('mensaje', {	
						usuario: req.session.Username,
						mensaje: data
					});
			});
		
	});

	socket.on('getSalas', function(data){
		db.query('SELECT id, nombre_sala FROM salas', function(err, result, fields){
			if(err) throw err;
			socket.emit('Salas', result);
		});
	});
	
	socket.on('salir', function(request, response){		//Se recibe el parametro de salir

		/* bottxt('salioUsuario');

		socket.leave(req.session.roomName); */
		req.session.destroy();							//Destruimos sesión
	});

	function bottxt(data){
		entroSala = 'Bienvenido a la sala ' + req.session.roomName;
		cambioSala = 'Cambiaste de sala a ' + req.session.roomName;
		/* sefue = 'El usuario ' + req.session.Username + 'ha salido de la sala.';
 */
		if(data == "entroSala"){
			socket.emit('mensaje',{
				usuario: nameBot,
				mensaje: entroSala
			});
		}
		if (data == "cambioSala"){
			socket.emit('mensaje',{
				usuario: nameBot,
				mensaje: cambioSala
			});
		}

		/* if(data == "salioUsuario"){
			socket.emit('mensaje',{
				usuario: nameBot,
				mensaje: sefue
			});
		} */
	}
});