var request = require('request');
var vapix = require('./vapix.js');

module.exports = function(RED) {
    function AxisDevice(config) {
        RED.nodes.createNode(this,config);
		this.account = config.account;
		this.address = config.address;
		this.action = config.action;
		this.protocol = config.protocol;
		this.data = config.data;
		this.output = config.output;
        var node = this;
        node.on('input', function(msg) {
			var address = msg.address || node.address;
			var action = msg.action || node.action;
			var account = RED.nodes.getNode(this.account);
			var user = msg.user || account.credentials.username;
			var password = msg.password || account.credentials.password;
			var data = msg.data || node.data;
			var protocol = account.protocol;
			if( address.length < 6 ) {
				msg.error = "Invalid address";
				msg.payload = {};
				node.send(msg);
				return;
			}
			//console.log(action + ":" + address + "/" + data);
			switch( action ) {
				case "Image":
					var mediaProfile = data;
					vapix.image( protocol + '://' + address, user, password, mediaProfile, function(error,response ) {
						if( error ) {
							msg.error = true;
							msg.payload = response.toString();
						} else{
							msg.error = false;
							if( node.output === "base64" )
								msg.payload = response.toString('base64');
							else
								msg.payload = response;
						}
						node.send(msg);
					});
				break;
				
				case "HTTP GET":
					var options = {
						url: protocol + '://' + address + '/' + data,
						strictSSL: false
					}
					//console.log(options);
					if( node.output === "binary" || node.output === "base64" )
						options.encoding = null;
					request.get(options, function (error, response, body) {
						//console.log("Response Error: " + error );
						msg.topic = options.url;
						if( error ) {
							msg.error = true;
							msg.payload = body.toString();
							return;
						}
						if( response.statusCode !== 200 ) {
							//console.log("Response Error: " + response.statusCode );
							msg.error = true;
							msg.payload = body.toString();
							return;
						}
						//console.log("Parsing");
						msg.payload = body;
						if( node.output === "base64")
							msg.payload = body.toString('base64');
						if( node.output === "json" ) {
							msg.payload = JSON.parse(body);
							if( !msg.payload ) {
								msg.error = true;
								msg.payload = "Error parsing resonse as JSON";
							}
						}
						//console.log("Send");
						node.send(msg);
					}).auth( user, password, false);
				break;
				
				case "Get Properties":
					//console.log("Get properties: Request" );
					vapix.getParam( protocol + '://' + address, user, password, data, function( error, response ) {
						//console.log("Get properties: Response" );
						msg.payload = response;
						if( error )
							msg.error = error;
						else
							msg.error = false;
						msg.topic = data;
						node.send( msg );
					});
				break;
				
				case "Set Properties":
					vapix.setParam( protocol + '://' + address, user, password, data, msg.payload, function(error, response ){
						msg.payload = response;
						if( error )
							msg.error = error;
						else
							msg.error = false;
						node.send( msg );
					});
				break;

				case "List Connections":
					vapix.request( protocol + '://' + address + '/axis-cgi/admin/connection_list.cgi?action=get', user, password, function(error,response ) {
						if( error ) {
							msg.error = true;
							msg.payload = response;
						} else {
							msg.error = false;
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
						}
						node.send(msg);
					});
				break;
				
				case 'List Events':
					vapix.listEvents( protocol + '://' + address, user, password, function( error, response ) {
						if( error )
							msg.error = true;
						else	
							msg.error = false;
						msg.payload = response;
						node.send(msg);
					});
				break;
				
				case 'List ACAP':
					vapix.listACAP( protocol + '://' + address, user, password, function(error, response ) {
						msg.payload = response;
						if( error )
							msg.error = error;
						else
							msg.error = false;
						node.send( msg );
					});
				break;

				case 'Start ACAP':
					vapix.controlACAP( protocol + '://' + address, user, password, "start", data,  function(error, response ) {
						msg.payload = response;
						if( error )
							msg.error = error;
						else
							msg.error = false;
						node.send( msg );
					});
				break;
				case 'Stop ACAP':
					vapix.controlACAP( protocol + '://' + address, user, password, "stop", data,  function(error, response ) {
						msg.payload = response;
						if( error )
							msg.error = error;
						else
							msg.error = false;
						node.send( msg );
					});
				break;
				case 'Remove ACAP':
					vapix.controlACAP( protocol + '://' + address, user, password, "remove", data,  function(error, response ) {
						msg.payload = response;
						if( error )
							msg.error = error;
						else
							msg.error = false;
						node.send( msg );
					});
				break;

				case 'Install ACAP':
					//console.log("Installing ACAP " + data );
					node.status({fill:"blue",shape:"dot",text:"Installing..."});
					vapix.installACAP( protocol + '://' +  address, user, password, data, function(error, response ) {
						msg.payload = response;
						if( error ) {
							node.status({fill:"red",shape:"dot",text:"Failed"});
							msg.error = error;
						} else {
							node.status({fill:"green",shape:"dot",text:"Success"});
							msg.error = false;
						}
						node.send( msg );
					});
				break;
				
				case "List Accounts":
					vapix.listAccounts( protocol + '://' + address, user, password, function(error, response ) {
						msg.payload = response;
						if( error )
							msg.error = error;
						else
							msg.error = false;
						node.send( msg );
					});
				break;

				case "Set Account":
					vapix.setAccount(  protocol + '://' + address, user, password, msg.payload, function(error,response) {
						msg.error = false;
						msg.payload = response;
						if( error )
							msg.error = error;
						node.send( msg );
					});
				break;
				
				case "List Certificates":
					vapix.listCertificates(  protocol + '://' + address, user, password, function(error, response ) {
						if( error )
							msg.error = true;
						else	
							msg.error = false;
						msg.payload = response
						node.send(msg);
					});
				break;
				
				case "Create Certificate":
					vapix.createCertificate( protocol + '://' + address, user, password, data, msg.payload, function(error, response) {
						if( error )
							msg.error = true;
						else	
							msg.error = false;
						msg.payload = response;
						node.send(msg);
					});
				break;
				
				case "Request CSR":
					vapix.requestCSR( protocol + '://' + address, user, password, data, msg.payload, function(error, response) {
						if( error )
							msg.error = true;
						else	
							msg.error = false;
						msg.payload = response;
						node.send(msg);
					});
				break;
				
				case "Restart":
					vapix.request(protocol + '://' + address + '/axis-cgi/restart.cgi', user, password, function(error,response ) {
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
	
    RED.nodes.registerType("device",AxisDevice,{
		defaults: {
            name: {type:"text"},
			account: {type:"device-credentials"},
			address: {type:"text"},
			action: { type:"text" },
			data: {type:"text"},
			output: { type: "default"}
		}		
	});
	
	function Axis_Device_Credentials(config) {
			RED.nodes.createNode(this,config);
			this.name = config.name;
			this.protocol = config.protocol;
	}
	
	RED.nodes.registerType("device-credentials",Axis_Device_Credentials,{
		defaults: {
            name: {type:""},
			protocol: {type:"text"}
		},
		credentials: {
			username: {type:"text"},
			password: {type:"password"}
		}		
	});
}
