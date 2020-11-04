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
					msg.error = false;
					var info = {
						serial: null,
						type: "Undefined",
						model: "Undefined",
						IPv4: null,
						IPv6: null,
						hostname: null,
						audio: false,
						platform: null,
						chipset: null,
						firmware: null,
						resolutions: null
					};
					//Brand
					vapix.getParam( camera, "brand", function( error, response ) {
						msg.error = false;
						if( error ) {
							msg.error = true;
							msg.payload = {
								request: "brand",
								error: error,
								response: response,
								device: info
							}
							node.send( msg );
							return;
						}
						if( response.hasOwnProperty("ProdNbr") )
							info.model = response.ProdNbr;
						if( response.hasOwnProperty("ProdType") )
							info.type = response.ProdType;
						vapix.getParam( camera, "network", function( error, response ) {
							if( error ) {
								msg.error = true;
								msg.payload = {
									request: "network",
									error: error,
									response: response,
									device: info
								}
								node.send( msg );
								return;
							}
							if( response.hasOwnProperty("HostName") )
								info.hostname = response.HostName;
							if( response.hasOwnProperty("VolatileHostName") )
								info.hostname = response.VolatileHostName.HostName;
							if( response.hasOwnProperty("eth0") ) {
								if( response.eth0.hasOwnProperty("IPAddress") )
									info.IPv4 = response.eth0.IPAddress;
								if( response.eth0.hasOwnProperty("IPv6") && response.eth0.IPv6.hasOwnProperty("IPAddresses") )
									info.IPv6 = response.eth0.IPv6.IPAddresses;
								if( response.eth0.hasOwnProperty("MACAddress") )
									info.mac = response.eth0.MACAddress;
							}
							//Properties
							vapix.getParam( camera, "properties", function( error, response ) {
								if( error ) {
									msg.error = true;
									msg.payload = {
										request: "properties",
										error: error,
										response: response,
										device: info
									}
									node.send( msg );
									return;
								}
								if( response.hasOwnProperty("Firmware") && response.Firmware.hasOwnProperty("Version"))
									info.firmware = response.Firmware.Version;
								if( response.hasOwnProperty("System") ) {
									if(  response.System.hasOwnProperty("SerialNumber") )
										info.serial = response.System.SerialNumber;
									if( response.System.hasOwnProperty("Architecture") )
										info.platform = response.System.Architecture;
									if( response.System.hasOwnProperty("Soc") ) {
										var items = response.System.Soc.split(' ');
										if( items.length > 1 )
											info.chipset = items[1];
										else
											info.chipset = response.System.Soc;
									}
								}
								if( response.hasOwnProperty("Audio") && response.Audio.hasOwnProperty("Audio") )
									info.audio = response.Audio.Audio;

								if( response.hasOwnProperty("Image") && response.Image.hasOwnProperty("Resolution") ) {
									resolutions =  response.Image.Resolution.split(',');
									info.resolutions = {
										list: resolutions,
										max: resolutions.length>1?resolutions[0]:null,
										min: resolutions.length>1?resolutions[resolutions.length-1]:null,
										med: "640x360",	
										aspect: "16:9",
										rotation: 0
									}
									vapix.getParam( camera, "ImageSource.I0", function( error, response ) {
										if( error ) {
											msg.error = true;
											msg.payload = {
												request: "ImageSource",
												error: error,
												response: response,
												device: info
											}
											node.send(msg);
											return;
										}
									
										if( response && response.hasOwnProperty("I0") ) { 
											if( response.I0.hasOwnProperty("Sensor") && response.I0.Sensor.hasOwnProperty("AspectRatio") ) {
												info.resolutions.aspect  = response.I0.Sensor.AspectRatio;
												if( info.resolutions.aspect === "4:3")
													info.resolutions.med = "640x480";
												if( info.resolutions.aspect === "1:1")
													info.resolutions.med = "640x640";
												if( info.resolutions.aspect === "16:10")
													info.resolutions.med = "640x400";
											}
											if( response.I0.hasOwnProperty("Rotation") )
												info.resolutions.rotation = parseInt(response.I0.Rotation);
										}
										msg.payload = info;
										node.send( msg );
									});
								} else {
									msg.payload = info;
									node.send( msg );
								}
							});
						});
					});
				break;
				
				case "Image":
					vapix.image( camera, payload, function(error,response ) {
						if( error ) {
							msg.error = true;
							msg.payload = response?response.toString():"No response";
							node.send(msg);
							return;
						}
						msg.error = false;
						msg.payload = response;
						console.log("Image format = " + format );
						if( format === "base64" )
							msg.payload = response.toString('base64');
						node.send(msg);
					});
				break;

				case "HTTP GET":
					vapix.get( camera, payload, function( error, body ) {
						msg.payload = body;
						if( error ) {
							msg.error = true;
							node.send(msg);
							return;
						}

						if( format === "base64" )
							msg.payload = body.toString('base64');
						if( format === "json" )
							msg.payload = JSON.parse(body);

						node.send(msg);
					});
				break;

				case "HTTP POST":
					if( !msg.url || msg.url.length < 5 ) {
						msg.error=true;
						msg.payload = "Invalid msg.url";
						node.send(msg);
						return;
					}
					if( format === "json" ) {
						vapix.postJSON( camera, msg.url, payload, function( error, body ) {
							msg.payload = body;
							if( error ) {
								msg.error = true;
								node.send(msg);
								return;
							}
							node.send(msg);
						});
						return;
					} 
					vapix.postBody( camera, msg.url, payload, function( error, body ) {
						msg.payload = body;
						if( error ) {
							msg.error = true;
							node.send(msg);
							return;
						}
						node.send(msg);
					});
				break;
					
				case "Get Properties":
					vapix.getParam( camera, payload, function( error, response ) {
						msg.payload = response?response:"No response";
						if( error )
							msg.error = true;
						node.send( msg );
					});
				break;
				
				case "Set Properties":
					vapix.setParam( camera, msg.topic, payload, function(error, response ){
						msg.payload = response?response:"No response";
						if( error )
							msg.error = true;
						node.send( msg );
					});
				break;
				
				case "List Accounts":
					vapix.listAccounts( camera, function(error, response ) {
						msg.payload = response;
						if( error )
							msg.error = true;
						node.send( msg );
					});
				break;

				case "Set Account":
					vapix.setAccount( camera, payload, function(error, response) {
						msg.payload = response;
						if( error )
							msg.error = true;
						node.send( msg );
					});
				break;
				
				case "Remove Account":
					vapix.removeAccount( camera, payload, function(error, response) {
						msg.payload = response;
						if( error )
							msg.error = true;
						node.send( msg );
					});
				break;

				case "MQTT Status": 
					vapix.mqttClientStatus( camera, function(error, response) {
						msg.payload = response;
						if( error )
							msg.error = true;
						node.send( msg );
					});
				break;
				
				case "MQTT Connect":
					vapix.mqttConnect( camera, payload, function(error, response) {
						msg.payload = response;
						if( error )
							msg.error = true;
						node.send( msg );
					});
				break;
				
				case "Get MQTT Publish":
					vapix.mqttGetPublishing( camera, function(error, response) {
						msg.payload = response;
						if( error )
							msg.error = true;
						node.send( msg );
					});
				break;
				
				case "Set MQTT Publish":
					vapix.mqttSetPublishing( camera, payload, function(error, response) {
						msg.payload = response;
						if( error )
							msg.error = true;
						node.send( msg );
					});
				break;

				case 'List ACAP':
					vapix.listACAP( camera, function(error, response ) {
						msg.payload = response;
						if( error )
							msg.error = true;
						node.send( msg );
					});
				break;

				case 'Start ACAP':
					vapix.controlACAP( camera, "start", payload,  function(error, response ) {
						msg.payload = response;
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

				case "List Connections":
					vapix.listConnections( camera, function(error, response ) {
						msg.payload = response;
						if( error )	msg.error = true;
						node.send( msg );
					});
				break;

				case "Restart":
					vapix.restart( camera, function(error, response ) {
						msg.payload = response;
						if( error )	msg.error = true;
						node.send( msg );
					});
				break;

				case "List Certificates":
					vapix.listCertificates( camera, function(error, response ) {
						msg.payload = response
						if( error )	msg.error = true;
						node.send(msg);
					});
				break;
				
				case "Create Certificate":
					node.status({fill:"blue",shape:"dot",text:"Generating key..."});
					vapix.createCertificate( camera, msg.topic, payload, function(error, response) {
						if( error ){
							node.status({fill:"red",shape:"dot",text:"Failed"});
							msg.error = true;
						} else {
							node.status({fill:"green",shape:"dot",text:"Success"});
						}
						msg.payload = response;
						node.send(msg);
					});
				break;
				
				case "Request CSR":
					node.status({fill:"blue",shape:"dot",text:"Generating key..."});
					vapix.requestCSR( camera, msg.topic, payload, function(error, response) {
						msg.error = false;
						if( error ){
							node.status({fill:"red",shape:"dot",text:"Failed"});
							msg.error = true;
						} else {
							node.status({fill:"green",shape:"dot",text:"Success"});
						}
						msg.payload = response;
						node.send(msg);
					});
				break;

				case 'Firmware Update':
					node.status({fill:"blue",shape:"dot",text:"Updating..."});
					vapix.updateFirmware( camera , payload, function(error, response ) {
						msg.payload = response;
						msg.error = false;
						if( error ) {
							node.status({fill:"red",shape:"dot",text:"Failed"});
							msg.error = true;
						} else {
							msg.payload = JSON.parse(msg.payload);
							if( msg.payload.hasOwnProperty("error") ) {
								msg.error = true;
								node.status({fill:"red",shape:"dot",text:"Failed"});
								msg.payload = msg.payload.error;
							} else {
								msg.payload = msg.payload.data;
								node.status({fill:"green",shape:"dot",text:"Success"});
							}
						}
						node.send( msg );
					});
				break;
				
				case "Remote Syslog":
					vapix.get(camera,'/axis-cgi/param.cgi?action=update&root.system.editcgi=yes', function(error,response ) {
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
							vapix.get(camera, '/axis-cgi/param.cgi?action=update&root.system.editcgi=no', function(error,response ) {});
						});
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
