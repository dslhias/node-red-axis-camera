## Node-Red node for Axis Camera
The most common VAPIX and ONVIF requests for Axis Devices with a much more simplified parsed response than what Axis device API produces.
* Get JPEG image
* Get/Set properties
* List/Set user accounts
* List/Start/Stop/Install ACAP
* Restart device
* List/Create Certificates & Signing requests
* List device connections
* Enable remote syslog server
* Update Firmware

## Installation

Go to the node-red directory
```
cd ~/.node-red

or, if using doreme docker instance

cd ~/doreme/nodered

```
Install package
```
npm install pandosme/node-red-axis-camera
```
Restart Node-Red
Refresh your web page to load new nodes in the pallet
