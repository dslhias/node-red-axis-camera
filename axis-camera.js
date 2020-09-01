var request = require('request');
var vapix = require('./vapix.js');

module.exports = function(RED) {
	function Axis_Camera_Account(config) {
		RED.nodes.createNode(this,config);
		this.name = config.name;
		this.protocol = config.protocol;
	}
	
	RED.nodes.registerType("Camera Account",Axis_Camera_Account,{
		defaults: {
			name: {type:""},
			protocol: {type:"text"}
		},
		credentials: {
			user: {type:"text"},
			password: {type:"password"}
		}		
	});
	
    function Axis_Camera_Node(config) {
	RED.nodes.createNode(this,config);
		this.account = config.account;
		this.address = config.address;
		this.action = config.action;
		this.data = config.data;
		this.format = config.format;
		var node = this;
		node.on('input', function(msg) {
			var account = RED.nodes.getNode(node.account);
			var address = msg.address || node.address;
			var camera = {
				url: account.protocol + '://' + address,
				user: msg.user || account.credentials.user,
				password: msg.password || account.credentials.password
			}
			if( !camera.user || camera.user.length < 2){msg.error = true;msg.payload = "Invalid input [user]";node.send(msg);return;}
			if( !camera.password || camera.password.length < 2){msg.error = true;msg.payload = "Invalid input [password]";node.send(msg);return;}
			if( !camera.url || camera.url.length < 10) {msg.error = true;msg.payload = "Invalid input [url])";node.send(msg);return;}
			var format = node.format;
			var action = msg.action || node.action;
			var payload = node.data || msg.payload;
			msg.error = false;
			
			switch( action ) {
				case "Info":
					var info = {};
					vapix.getParam( camera, "brand", function( error, response ) {
						msg.error = false;
						msg.payload = response;
						if( error ) {
							msg.payload = response? response.toString():"No response";
							msg.error = true;
							node.send( msg );
							return;
						}
						info.model = response.ProdNbr;
						vapix.getParam( camera, "properties", function( error, response ) {
							msg.error = false;
							msg.payload = response;
							if( error ) {
								msg.error = true;
								msg.payload = response? response.toString():"No response";
								node.send( msg );
								return;
							}
							info.serial = response.System.SerialNumber;
							info.platform = response.System.Architecture;
							info.chipset = "";
							if( response.System.hasOwnProperty("Soc") ) {
								var items = response.System.Soc.split(' ');
								if( items.length > 1 )
									info.chipset = items[1];
								else
									info.chipset = response.System.Soc;
							}
							info.firmware = response.Firmware.Version;
							info.resolution = response.Image.Resolution.split(',')[0];
							vapix.getParam( camera, "network", function( error, response ) {
								msg.error = false;
								msg.payload = response;
								if( error ) {
									msg.error = true;
									msg.payload = response? response.toString():"No response";
									node.send( msg );
									return;
								}
								info.hostname = response.HostName;
								if( response.hasOwnProperty("VolatileHostName") )
									info.hostname = response.VolatileHostName.HostName;
								info.IPv4 = response.eth0.IPAddress;
								if( response.eth0.hasOwnProperty("IPv6") && response.eth0.IPv6.hasOwnProperty("IPAddresses") )
									info.IPv6 = response.eth0.IPv6.IPAddresses;
								info.mac = response.eth0.MACAddress;
								msg.payload = info;
								node.send(msg);
							});
						});
					});
				break;
				
				case "Image":
					vapix.image( camera, payload, function(error,response ) {
						if( error ) {msg.error = true;msg.payload = response?response.toString():"No response";node.send(msg);return;}
						msg.error = false;
						msg.payload = response;
						if( format === "base64" )
							msg.payload = response.toString('base64');
						node.send(msg);
					});
				break;
				
				case "HTTP GET":
					var options = {url: camera.url + payload, strictSSL: false}
					if( format === "binary" || format === "base64" )
						options.encoding = null;
					request.get(options, function (error, response, body) {
						if( error ) {msg.error = true;msg.payload = response?response.toString():"No response";node.send(msg);return;}
						if( response.statusCode !== 200 ) {msg.error=true;msg.payload = body.toString();node.send(msg);return;}
						msg.payload = body;
						if( format === "base64")
							msg.payload = body.toString('base64');
						if( format === "json" ) {
							msg.payload = JSON.parse(body);
							if( !msg.payload ) {msg.error = true;msg.payload = "Error parsing response as JSON";}
						}
						node.send(msg);
					}).auth( camera.user, camera.password, false);
				break;

				case "HTTP POST":
					if( !msg.url || msg.url.length < 5 ){msg.error=true;msg.payload = "Invalid msg.url";node.send(msg);return;}
					var options = {url: camera.url + msg.url, body: msg.payload, strictSSL: false}
					
					if( typeof msg.payload === 'object' ) {
						options.headers = {'Content-Type': 'application/json'};
						options.body = JSON.stringify(msg.payload);
					}
					
					if( format === "binary" || format === "base64" )
						options.encoding = null;
					
					request.post(options, function (error, response, body) {
						msg.error = false;
						if( error ) {msg.error = true;msg.payload = response?response.toString():"No response";node.send(msg);return;}
						if( response.statusCode !== 200 ) {msg.error=true;msg.payload = body.toString();node.send(msg);return;}
						msg.payload = body;
						if( format === "base64")
							msg.payload = body.toString('base64');
						if( format === "json" ) {
							msg.payload = JSON.parse(body);
							if( !msg.payload ) {msg.error = true;msg.payload = "Error parsing response as JSON";}
						}
						node.send(msg);
					}).auth( camera.user, camera.password, false);
				break;
					
				case "Get Properties":
					vapix.getParam( camera, payload, function( error, response ) {
						msg.error = false;
						msg.payload = response?response:"No response";
						if( error )
							msg.error = true;
						node.send( msg );
					});
				break;
				
				case "Set Properties":
					vapix.setParam( camera, msg.topic, payload, function(error, response ){
						msg.error = false;
						msg.payload = response?response:"No response";
						if( error )
							msg.error = true;
						node.send( msg );
					});
				break;
				
				case "List Accounts":
					vapix.listAccounts( camera, function(error, response ) {
						msg.payload = response?response:"No response";
						msg.error = false;
						if( error )
							msg.error = true;
						node.send( msg );
					});
				break;

				case "Set Account":
					vapix.setAccount( camera, payload, function(error,response) {
						msg.error = false;
						msg.payload = response?response:"No response";
						if( error )
							msg.error = error;
						node.send( msg );
					});
				break;

				case "MQTT Client":
					var options = {
						headers: {'Content-Type': 'application/json'},
						strictSSL: false,
						url: camera.url + "/axis-cgi/mqtt/client.cgi",
						body: JSON.stringify({apiVersion: "1.0",context: "Node-Red",method: "getClientStatus"})
					};
					request.post(options, function (error, response, body) {
						if( error ) {msg.error = true;msg.payload = response?response.toString():"No response";node.send(msg);return;}
						if( response.statusCode !== 200 ) {msg.error=true;msg.payload = body.toString();node.send(msg);return;}
						var client = JSON.parse(body).data;
//						console.log(client.config.lastWillTestament);
						msg.payload = {
							active: client.status.state === "active",
							status: client.status.connectionStatus, //connected, connecting, failed, disconnected
							connected: client.status.connectionStatus === "Connected",
							host: client.config.server.host,
							port: client.config.server.port.toString(),
							id: client.config.clientId,
							tls: client.config.server.protocol === "ssl",
							validateCertificate: client.config.ssl.validateServerCert,
							user: client.config.username,
							password: '********',
							lastWillTestament: null,
							announcement: null
						}
						if( client.config.hasOwnProperty("lastWillTestament") ) {
							if( client.config.lastWillTestament.useDefault ) {
								msg.payload.lastWillTestament = {
									topic: "default",
									payload: "default"
								}
							} else {
								msg.payload.lastWillTestament = {
									topic: client.config.lastWillTestament.topic,
									payload: JSON.parse(client.config.lastWillTestament.message)
								}
							}
						}
						if( client.config.hasOwnProperty("connectMessage") ) {
							if( client.config.connectMessage.useDefault ) {
								msg.payload.announcement = {
									topic: "default",
									payload: "default"
								}
							} else {
								msg.payload.announcement = {
									topic: client.config.connectMessage.topic,
									payload: JSON.parse(client.config.connectMessage.message)
								}
							}
						}
//						console.log(msg.payload);
						node.send(msg);
					}).auth( camera.user, camera.password, false);
				break;
				
				case "MQTT Connect":
					var options = {}
					var connect = true;
					var settings = msg.payload;
					if( settings === null || settings === false ) {  //Disconnect request
						options = {
							headers: {'Content-Type': 'application/json'},
							strictSSL: false,
							url: camera.url + "/axis-cgi/mqtt/client.cgi",
							body: JSON.stringify({apiVersion: "1.0",context: "Node-Red",method: "deactivateClient"})
						};
						request.post(options, function (error, response, body) {
							if( error ) {msg.error = true;msg.payload = body;node.send(msg);return;}
							if( response.statusCode !== 200 ) {msg.error=true;msg.payload = body.toString();node.send(msg);return;}
							msg.payload = "Disconnecting";
							node.send(msg);
						}).auth( camera.user, camera.password, false);
						return;
					}
					
					var user = "";
					var password = "";
					var tls = false;
					var validateCertificate = false;
					
					if( !settings.hasOwnProperty("host") || settings.host.length === 0 ) {
						msg.error = true;
						msg.payload = "Host needs to be set";
						node.send(msg);
						return;
					}
					if( !settings.hasOwnProperty("port") || settings.port.length === 0 ) {
						msg.error = true;
						msg.payload = "Port needs to be set";
						node.send(msg);
						return;
					}
					
					if( !settings.hasOwnProperty("id") || settings.id.length === 0 ) {
						msg.error = true;
						msg.payload = "Client id needs to be set";
						node.send(msg);
						return;
					}

					if( settings.hasOwnProperty("tls") )
						tls = settings.tls === true;

					var params = {
							activateOnReboot: true,
							server: {
								protocol: tls?"ssl":"tcp",
								host: settings.host,
								port: parseInt(settings.port),
						//      "basepath":"url-extension"
							},
							ssl: {
								validateServerCert: validateCertificate
							},
							username: settings.user || "",
							password: settings.password || "",
							clientId: settings.id,
							keepAliveInterval: 60,
							connectTimeout: 60,	
							cleanSession: true,
							autoReconnect: true
					}
					
					if( settings.hasOwnProperty("lastWillTestament") && settings.lastWillTestament !== null && settings.lastWillTestament !== false ) {
						params.lastWillTestament = {
							useDefault: false,
							topic: settings.lastWillTestament.topic,
							message: settings.lastWillTestament.payload,
							retain: true,
							qos: 1							
						}
						//console.log(settings.lastWillTestament.payload);
						if( typeof settings.lastWillTestament.payload === 'object' )
							params.lastWillTestament.message = JSON.stringify(settings.lastWillTestament.payload);
						params.disconnectMessage = JSON.parse(JSON.stringify(params.lastWillTestament));
					}
					if( settings.hasOwnProperty("announcement") && settings.announcement !== null && settings.announcement !== false ) {
						params.connectMessage = {
							useDefault: false,
							topic: settings.announcement.topic,
							message: settings.announcement.payload,
							retain: true,
							qos: 1							
						}
						if( typeof settings.announcement.payload === 'object' )
							params.connectMessage.message = JSON.stringify(settings.announcement.payload);
					}
					//console.log(params);
					var options = {
						headers: {'Content-Type': 'application/json'},
						strictSSL: false,
						url: camera.url + "/axis-cgi/mqtt/client.cgi",
						body: JSON.stringify({apiVersion: "1.0",context: "Node-Red",method: "configureClient",params: params})
					};
					request.post(options, function (error, response, body) {
						if( error ) {msg.error = true;msg.payload = body;node.send(msg);return;}
						if( response.statusCode !== 200 ) {msg.error=true;msg.payload = body.toString();node.send(msg);return;}
						options = {
							headers: {'Content-Type': 'application/json'},
							strictSSL: false,
							url: camera.url + "/axis-cgi/mqtt/client.cgi",
							body: JSON.stringify({apiVersion: "1.0",context: "Node-Red",method: "activateClient"})
						};
						request.post(options, function (error, response, body) {
							if( error ) {msg.error = true;msg.payload = body;node.send(msg);return;}
							if( response.statusCode !== 200 ) {msg.error=true;msg.payload = body.toString();node.send(msg);return;}
							msg.payload = "Connecting";
							node.send(msg);
						}).auth( camera.user, camera.password, false);
					}).auth( camera.user, camera.password, false);
				break;
				
				case "Get MQTT Publish":
					var options = {
						headers: {'Content-Type': 'application/json'},
						strictSSL: false,
						url: camera.url + "/axis-cgi/mqtt/event.cgi",
						body: JSON.stringify({apiVersion: "1.0",context: "Node-Red",method: "getEventPublicationConfig"})
					};
					request.post(options, function (error, response, body) {
						if( error ) {msg.error = true;msg.payload = body;node.send(msg);return;}
						if( response.statusCode !== 200 ) {msg.error=true;msg.payload = body.toString();node.send(msg);return;}
						data = JSON.parse(body).data.eventPublicationConfig;
						//console.log(data);
						msg.payload = {
							topic: data.customTopicPrefix,
							onvif: data.appendEventTopic,
							events: []
						}
						for( var i = 0; i < data.eventFilterList.length; i++ )
							msg.payload.events.push(data.eventFilterList[i].topicFilter);
						node.send(msg);
					}).auth( camera.user, camera.password, false);
				break;
				
				case "Set MQTT Publish":
					var settings = msg.payload;
					if( !settings.hasOwnProperty("topic") ) {
						msg.error = true;
						msg.payload = "Topic needs to be set";
						node.send(msg);
						return;
					}
					if( !settings.hasOwnProperty("events") ) {
						msg.error = true;
						msg.payload = "Events needs to be set";
						node.send(msg);
						return;
					}
					if( !Array.isArray(settings.events) )
						settings.events = [];
					var list = [];
					for( var i = 0; i < settings.events.length; i++ ) {
						list.push( {
							topicFilter: settings.events[i],
							qos: 0,
							retain: "none"
						});
					}
					params = {
						eventFilterList:list,
						topicPrefix: "custom",
						customTopicPrefix: settings.topic,
						appendEventTopic: settings.onvif || false,
						includeTopicNamespaces : false,
						includeSerialNumberInPayload: true
					};
					var options = {
						headers: {'Content-Type': 'application/json'},
						strictSSL: false,
						url: camera.url + "/axis-cgi/mqtt/event.cgi",
						body: JSON.stringify({apiVersion: "1.0",context: "Node-Red",method: "configureEventPublication",params:params})
					};
					request.post(options, function (error, response, body) {
						if( error ) {msg.error = true;msg.payload = body;node.send(msg);return;}
						if( response.statusCode !== 200 ) {msg.error=true;msg.payload = body.toString();node.send(msg);return;}
						msg.payload = "OK";
						node.send(msg);
					}).auth( camera.user, camera.password, false);
				break;

				case "List Connections":
					vapix.request( camera, '/axis-cgi/admin/connection_list.cgi?action=get', function(error,response ) {
						msg.error = false;
						if( error ) {msg.error = true;msg.payload = response;node.send(msg);return;}
						var rows = response.split('\n');
						var list = [];
						for( var i = 1; i < rows.length; i++) {
							var row = rows[i].trim();
							row = row.replace(/\s{2,}/g, ' ');
							if( row.length > 10 ) {
								var items = row.split(' ');
								var ip = items[0].split('.');
								if( ip != '127' ) {
									list.push({
										address: items[0],
										protocol: items[1],
										port: items[2],
										service: items[3].split('/')[1]
									})
								}
							}
						}
						msg.payload = list;
						node.send(msg);
					});
				break;
				
				case 'List Events':
					vapix.listEvents( camera, function( error, response ) {
						msg.payload = response;
						msg.error = false;
						if( error )
							msg.error = true;
						node.send(msg);
					});
				break;
				
				case 'List ACAP':
					console.log("List ACAP");
					vapix.listACAP( camera, function(error, response ) {
						msg.error = false;
						msg.payload = response;
						if( error )
							msg.error = true;
						node.send( msg );
					});
				break;

				case 'Start ACAP':
					vapix.controlACAP( camera, "start", payload,  function(error, response ) {
						msg.payload = response;
						msg.error = false;
						if( error )
							msg.error = true;
						node.send( msg );
					});
				break;
				case 'Stop ACAP':
					vapix.controlACAP( camera, "stop", payload,  function(error, response ) {
						msg.payload = response;
						msg.error = false;
						if( error )
							msg.error = true;
						node.send( msg );
					});
				break;
					
				case 'Remove ACAP':
					vapix.controlACAP( camera, "remove", payload,  function(error, response ) {
						msg.payload = response;
						msg.payload = response;
						msg.error = false;
						if( error )
							msg.error = true;
						node.send( msg );
					});
				break;

				case 'Install ACAP':
					node.status({fill:"blue",shape:"dot",text:"Installing..."});
					vapix.installACAP( camera , payload, function(error, response ) {
						msg.payload = response;
						msg.error = false;
						if( error ) {
							node.status({fill:"red",shape:"dot",text:"Failed"});
							msg.error = true;
						} else {
							node.status({fill:"green",shape:"dot",text:"Success"});
						}
						node.send( msg );
					});
				break;

				case 'Firmware Update':
					node.status({fill:"blue",shape:"dot",text:"Updating..."});
					vapix.updateFimrware( camera , payload, function(error, response ) {
						payload = response;
						msg.error = false;
						if( error ) {
							node.status({fill:"red",shape:"dot",text:"Failed"});
							msg.error = true;
						} else {
							node.status({fill:"green",shape:"dot",text:"Success"});
						}
						node.send( msg );
					});
				break;
			
				case "List Certificates":
					vapix.listCertificates( camera, function(error, response ) {
						msg.error = false;
						msg.payload = response
						if( error )
							msg.error = true;
						node.send(msg);
					});
				break;
				
				case "Create Certificate":
					vapix.createCertificate( camera, msg.topic, payload, function(error, response) {
						msg.error = false;
						if( error )
							msg.error = true;
						msg.payload = response;
						node.send(msg);
					});
				break;
				
				case "Request CSR":
					vapix.requestCSR( camera, msg.topic, payload, function(error, response) {
						msg.error = false;
						if( error )
							msg.error = true;
						msg.payload = response;
						node.send(msg);
					});
				break;
				
				case "Restart":
					vapix.request(camera, '/axis-cgi/restart.cgi', function(error,response ) {
						if( error )
							msg.error = true;
						else	
							msg.error = false;
						msg.payload = response;
						node.send(msg);
					});
				break;
				
				case "Remote Syslog":
					vapix.request(camera,'/axis-cgi/param.cgi?action=update&root.system.editcgi=yes', function(error,response ) {
						if( error ) {msg.error = true;node.send(response);return;}
						if( response.search("Error") >= 0 || response.search("DOCTYPE") >= 0 ) {
							msg.error = true;
							msg.payload = response;
							node.send(msg);
							return;
						}
						var body = 'save_file=/etc/syslog-ng.d/remote.conf';
						body += '&mode=0100644';
						body += '&convert_crlf_to_lf=on';
						body += '&content=';
						body += '#Added by node-red-contrib-axis-camera Remote Syslog\n';
						if( !msg.payload || msg.payload === null || msg.payload === false ) {
							body += '#Remote syslog is disabled\n';
						} else {
							if( !msg.payload.hasOwnProperty('address') || !msg.payload.hasOwnProperty('level') || !msg.payload.hasOwnProperty('access')  || !msg.payload.hasOwnProperty('port') ) {
								msg.error = true;
								msg.payload = "Invalid input payload.  Required properties: address, port, level, access";
								node.send(msg);
								return;
							}
							body += 'destination d_remote-syslog { network("' + msg.payload.address + '" transport("tcp") port(' + msg.payload.port+ '));};\n';
							body += 'filter r_critical   { level(emerg..crit); };\n';
							body += 'filter r_error      { level(err); };\n';
							body += 'filter r_warning    { level(warning); };\n';
							body += 'filter r_info       { level(info); };\n';
							body += 'filter r_notice     { level(notice); };\n';
							body += 'filter r_auth       { facility(authpriv) or facility(auth); };\n';
							switch( msg.payload.level ) {
								case 'notice':
									body += 'log { source(s_system); filter(r_notice); destination(d_remote-syslog); };\n';
								case 'info':
									body += 'log { source(s_system); filter(r_info); destination(d_remote-syslog); };\n';
								case 'warning':
									body += 'log { source(s_system); filter(r_warning); destination(d_remote-syslog); };\n';
								case 'error':
									body += 'log { source(s_system); filter(r_error); destination(d_remote-syslog); };\n';
								case 'critical':
									body += 'log { source(s_system); filter(r_critical); destination(d_remote-syslog); };\n';
							}
							if( msg.payload.access )
								body += 'log { source(s_system); filter(f_auth); destination(d_remote-syslog); };\n';
						}
						vapix.post(camera, '/admin-bin/editcgi.cgi?file=/etc/syslog-ng.d/remote.conf', body, function(error,response ) {
							if( error ) {
								msg.error = true;
								msg.payload = response;
								node.send(msg);
							}
							msg.error = false;
							msg.payload = "OK";
							node.send(msg);
							vapix.request(camera, '/axis-cgi/param.cgi?action=update&root.system.editcgi=no', function(error,response ) {});
						});
					});
				break;
				
				default:
					msg.error = true;
					msg.statusCode = 0;
					msg.payload = action + " is not a valid action";
					node.send(msg);
				break;
			}
        });
    }
	
    RED.nodes.registerType("Axis Camera",Axis_Camera_Node,{
		defaults: {
            name: {type:"text"},
			account: {type:"Camera Account"},
			address: {type:"text"},
			data: {type: "text"},
			action: { type:"text" },
			format: { type: "text"}
		}		
	});
}
