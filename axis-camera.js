var request = require('request');
var vapix = require('./vapix.js');

module.exports = function(RED) {
    function AxisDevice(config) {
        RED.nodes.createNode(this,config);
		this.credentials = config.credentials;
		this.address = config.address;
		this.action = config.action;
		this.format = config.format;
		
        var node = this;
        node.on('input', function(msg) {
			var credentials = RED.nodes.getNode(this.credentials);
			this.camera = {
				url: credentials.protocol + '://' + msg.address || node.address,
				user: credentials.credentials.user,
				password: credentials.credentials.password
			}
			var format = node.format;
			var action = msg.action || node.action;
			switch( action ) {
				case "Image":
					var mediaProfile = data;
					vapix.image( camera, msg.payload, function(error,response ) {
						if( error ) {
							msg.error = true;
							msg.payload = response.toString();
							node.send(msg);
							return;
						}
						msg.error = false;
						if( format === "base64" )
							msg.payload = response.toString('base64');
						node.send(msg);
					});
				break;
				
				case "HTTP GET":
					var options = {url: camera.url + msg.payload, strictSSL: false}
					if( format === "binary" || format === "base64" )
						options.encoding = null;
					request.get(options, function (error, response, body) {
						if( error ) {
							msg.error = true;
							msg.payload = body.toString();
							node.send(msg);
							return;
						}
						if( response.statusCode !== 200 ) {
							msg.error = true;
							msg.payload = body.toString();
							node.send(msg);
							return;
						}
						msg.payload = body;
						if( format === "base64")
							msg.payload = body.toString('base64');
						if( format === "json" ) {
							msg.payload = JSON.parse(body);
							if( !msg.payload ) {
								msg.error = true;
								msg.payload = "Error parsing resonse as JSON";
							}
						}
						node.send(msg);
					}).auth( camera.user, camera.password, false);
				break;
				
				case "Get Properties":
					vapix.getParam( camera, msg.payload, function( error, response ) {
						msg.error = false;
						msg.payload = response;
						if( error )
							msg.error = true;
						else
						node.send( msg );
					});
				break;
				
				case "Set Properties":
					vapix.setParam( camera, msg.payload, function(error, response ){
						msg.error = false;
						msg.payload = response;
						if( error )
							msg.error = true;
						node.send( msg );
					});
				break;

				case "List Connections":
					vapix.request( camera, '/axis-cgi/admin/connection_list.cgi?action=get', function(error,response ) {
						msg.error = false;
						if( error ) {
							msg.error = true;
							msg.payload = response;
							node.send(msg);
							return;
						}
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
						msg.error = false;
						if( error ) {
							msg.error = true;
							msg.payload = response;
							node.send(msg);
							return;
						}
						msg.payload = response;
						node.send(msg);
					});
				break;
				
				case 'List ACAP':
					vapix.listACAP( camera, function(error, response ) {
						msg.error = false;
						msg.payload = response;
						if( error )
							msg.error = true;
						else
						node.send( msg );
					});
				break;

				case 'Start ACAP':
					vapix.controlACAP( camera, "start", data,  function(error, response ) {
						msg.payload = response;
						msg.error = false;
						if( error ) {
							msg.error = true;
							msg.payload = error;
						}
						node.send( msg );
					});
				break;
				case 'Stop ACAP':
					vapix.controlACAP( camera, "stop", data,  function(error, response ) {
						msg.payload = response;
						msg.error = false;
						if( error ) {
							msg.error = true;
							msg.payload = error;
						}
						node.send( msg );
					});
				break;
				case 'Remove ACAP':
					vapix.controlACAP( camera, "remove", data,  function(error, response ) {
						msg.payload = response;
						msg.error = false;
						if( error ) {
							msg.error = true;
							msg.payload = error;
						}
						node.send( msg );
					});
				break;

				case 'Install ACAP':
					node.status({fill:"blue",shape:"dot",text:"Installing..."});
					vapix.installACAP( camera , msg.payload, function(error, response ) {
						msg.payload = response;
						msg.error = false;
						if( error ) {
							node.status({fill:"red",shape:"dot",text:"Failed"});
							msg.error = error;
						} else {
							node.status({fill:"green",shape:"dot",text:"Success"});
						}
						node.send( msg );
					});
				break;
				
				case "List Accounts":
					vapix.listAccounts( camera, function(error, response ) {
						msg.payload = response;
						msg.error = false;
						if( error )
							msg.error = true;
						node.send( msg );
					});
				break;

				case "Set Account":
					vapix.setAccount( camera, msg.payload, function(error,response) {
						msg.error = false;
						msg.payload = response;
						if( error )
							msg.error = error;
						node.send( msg );
					});
				break;
				
				case "List Certificates":
					vapix.listCertificates( camera, user, password, function(error, response ) {
						msg.error = false;
						if( error )
							msg.error = true;
						else	
						msg.payload = response
						node.send(msg);
					});
				break;
				
				case "Create Certificate":
					vapix.createCertificate( camera, msg.payload, function(error, response) {
						if( error )
							msg.error = true;
						else	
							msg.error = false;
						msg.payload = response;
						node.send(msg);
					});
				break;
				
				case "Request CSR":
					vapix.requestCSR( camera, msg.payload, function(error, response) {
						if( error )
							msg.error = true;
						else	
							msg.error = false;
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
					vapix.request(protocol + '://' + address + '/axis-cgi/param.cgi?action=update&root.system.editcgi=yes', user, password, function(error,response ) {
						if( error ) {
							msg.error = true;
							node.send(response);
							return;
							}
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
						body += '#Added by node-red-axis syslog config\n';
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
						vapix.post(protocol + '://' + address + '/admin-bin/editcgi.cgi?file=/etc/syslog-ng.d/remote.conf', body, user, password, function(error,response ) {
							if( error ) {
								msg.error = true;
								msg.payload = response;
								node.send(msg);
							}
							msg.error = false;
							msg.payload = "OK";
							node.send(msg);
							vapix.request(protocol + '://' + address + '/axis-cgi/param.cgi?action=update&root.system.editcgi=no', user, password, function(error,response ) {});
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
	
    RED.nodes.registerType("Axis Camera",AxisDevice,{
		defaults: {
            name: {type:"text"},
			credentials: {type:"Camera Credentials"},
			address: {type:"text"},
			action: { type:"text" },
			data: {type:"text"},
			format: { type: "text"}
		}		
	});
	
	function Axis_Camera_Credentials(config) {
			RED.nodes.createNode(this,config);
			this.name = config.name;
			this.protocol = config.protocol;
	}
	
	RED.nodes.registerType("Camera Credentials",Axis_Camera_Credentials,{
		defaults: {
            name: {type:""},
			protocol: {type:"text"}
		},
		credentials: {
			user: {type:"text"},
			password: {type:"password"}
		}		
	});
}
