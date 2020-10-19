# The WiFi Project

## Intro
*So, what is this all about?*  
The "WiFi Project" focuses on active and passive wireless network sniffing and capturing WPA2 hashes containing the network PSK. This is mostly done by using [hcxdumptool by ZerBea](https://github.com/ZerBea/hcxdumptool). These hashes are then processed using [dwpa by RealEnder](https://github.com/RealEnder/dwpa) We're currently using the official wpa-sec backend that can be found on [wpa-sec.stanev.org](https://wpa-sec.stanev.org/), but once we finish developing our own backend, we will launch our own dwpa installation. Once the hashes are cracked and PSKs are retrieved from dwpa, we use the [Wigle.net](https://wigle.net/) API to geolocate the networks and we import them into our own backend, which currently consists of an OpenStreetMaps Leaflet and an Android app. We then use this dataset to analyze wireless security, create statistics and do more research.

## How To Join / Contribute
If you'd like to join our project and access our dataset, you must also contribute. If you live in an area not already covered by our project or even in a different country, this should be fairly easy and should only take a few weeks of capturing. Our current requirements are **500 geolocated network PSKs with their respective network capture files**. You don't have to provide the coordinates to all of them yourself, you just need to be sure that these networks are on Wiglet.net - the easiest way to make sure is to run the [Wigle.net Android app](https://play.google.com/store/apps/details?id=net.wigle.wigleandroid) on your smartphone when capturing handshakes or use Kismet with a GPS module.

### Other Ways To Contribute
If you're interested in more than just capturing handshakes, that's great! There are plenty of other things you can do to help us or the projects we're using.

#### Contributing to Wigle.net 
By [wardriving](https://en.wikipedia.org/wiki/Wardriving) with the [Wigle.net app](https://play.google.com/store/apps/details?id=net.wigle.wigleandroid), you can help to improve their WiFi network database and improve location accuracy of the existing ones. You need to create an account to use the app and contribute, but you can choose to contribute anonymously. Even if you're not uploading anonymously, regular users are not able to see who uploaded which network except for their own uploads. If you have more questions, you can check out the [Wigle.net FAQ](https://wigle.net/faq) or [their forums](https://wigle.net/phpbb/).

#### Contributing to wpa-sec
The wpa-sec audior or *dwpa* uses distributed cracking power - hence its name, "Distributed WPA PSK auditor". They're not using some kind of a super-computer cluster tho, all of the processing time is provided by volunteers. People from our project are all trying to contribute as much processing power as they can, whether it's on a regular desktop with nVidia GTX 760 GPU or a dedicated high-performance server. And you can help too. All you need is Python 3, [Hashcat](https://hashcat.net/hashcat/) and the [help_crack.py](https://wpa-sec.stanev.org/hc/help_crack.py) script from wpa-sec. Before running the script, make sure that Hashcat is in your system path and your graphics card has a Cuda or OpenCL compatible drivers. Once you start the script, it will download some password dictionaries from wpa-sec and will start cracking uncracked networks. To see the networks your system has cracked so far, you can save them to a potfile. To do so, you can start the script with `-pot filename.txt` or define the potfile filename in the script variable `potfile`.

#### Contributing to our codebase
We currently have two open-source projects:

* [wpa-sec-api](https://github.com/Czechball/wpa-sec-api) by Czechball - a collection of bash scripts for interacting with wpa-sec and Wigle.net

* [wifi-passwords](https://gitlab.com/vojta-horanek/wifi-passwords) by vojta-horanek - our companion Android app

* The main web interface (this repo)

Contributing your code and improving the existing one is helpful, but reporting bugs and adding suggestions is also very useful.

## Using hcxdumptool
Our tool of choice for wireless traffic capturing is [hcxdumptool](https://github.com/ZerBea/hcxdumptool). It's modern, focused mostly on capturing hashes and is optimized for low-end devices like a Raspberry Pi.
### Installing
If you're running on Arch Linux, you can install hcxdumptool from the [hcxdumptool-git aur package](https://aur.archlinux.org/packages/hcxdumptool-git).  

Otherwise, you'll have to compile it yourself. Start by cloning the hcxdumptool repository:

```sh
git clone https://github.com/ZerBea/hcxdumptool.git
cd hcxdumptool
```
Then solve dependencies by installing `libcurl4-openssl-dev` and `libssl-dev` from your package manager, for example apt:

```sh
sudo apt install libcurl4-openssl-dev libssl-dev
```
Finally, compile hcxdumptool and install it in your system:

```sh
make
sudo make install
```
### Usage
Before you start capturing, you'll need a WiFi adapter that supports monitor mode. You can check out [this part](https://github.com/ZerBea/hcxdumptool#adapters) in hcxdumptool readme to learn more.  
Once your WiFi adapter is connected and you have all the required drivers installed, you can check if hcxdumptool supports it by running
```sh
sudo hcxdumptool -i <your interface> --do_rcascan
```
This will verify if your interface supports monitor mode and packet injection. If you see a list of sites with a "hit" counter that will increase after a short while, you should be good to go.  

Now, hcxdumptool can run in different modes and can capture hashes actively or passively. We recommend keeping the defaults but disabling client attacks, since they generate garbage when also wardriving with Wigle and hashes retrieved using those attacks are mostly useless.

You can disable client attacks with the ``--disable_client_attacks`` option. You can also run hcxdumptool in a fully passive mode with ``--silent``.

Here's a script example that can be used to quickly launch hcxdumptool:
```sh
#!/bin/bash

DATE=$(date +%Y-%m-%d_%H-%M-%S)
SAVE_DIR="/home/username/captures"

sudo hcxdumptool -i $1 -o $SAVE_DIR/$DATE.pcapng --enable_status=19 --disable_client_attacks
```

The `--enable-status` part is important, since this is the only info output you'll get. Check out hcxdumptool -h help page to see more combinations and choose one that you'll like. The most quiet option is 1, which will only announce captured hashes. Number 95 will provide you with all possible debug info.  

If you're running hcxdumptool frequently in the same locations, it might be handy to create an access point whitelist so you won't repeatedly attack networks that you already have hashes from. This can be done by creating a text file containing mac addresses in the following formats:
```
44:fe:3b:06:b4:d6
# or
44fe3b06b4d6
# and you can add comments like this, for example to label the APs
```
You can then tell hcxdumptool to use the whitelist with the following options:
``--filtermode=1 --filterlist_ap=<file>``
Keep in mind that this will only prevent hcxdumptool from actively attacking the network, it will still passively capture legitimate hanshakes generated by normal traffic.
## Using dwpa (wpa-sec)
Now that you have captured some hashes, it's time to start cracking them. You can of course use tools like Hashcat or John The Ripper, but our project is intended to work with wpa-sec so let's focus on that. First, start by creating your own key by visiting [wpa-sec.stanev.org](https://wpa-sec.stanev.org/) - this key will be used to upload your hashes and later download the potfile with PSKs. This key will be sent to your email and once you log in, it will be saved in your browser cookies.

This is where [wpa-sec-api](https://github.com/Czechball/wpa-sec-api) comes into play. Clone the repository and make sure you have `curl` and `jq` installed. Then put your wpa-sec key in the creds.txt file and you can start using the scripts.

You can upload your capture files using wpa-sec's web interface, or you can use the **upload-pcapng.sh** script. You can either upload a single file:
```sh
./upload-pcapng.sh -f filename.pcapng
```
or all .pcapng files from a directory
```sh
./upload-pcapng.sh -d path/to/directory
```

After you've uploaded some hashes, you can run **sort-pot.sh**. This script will download your potfile (a text file containing cracked PSKs and bssid and essid of their respective networks), sort it, remove client mac addresses and duplicates. The output will be **current.potfile**, which will contain your current cracked networks when running the script. But over time, you will eventually upload more hashes to wpa-sec and more hashes will get cracked. You can then run **sort-pot.sh** again, and it will compare your old potfile with the current one and create a file named **newsites.txt**, only containing newly cracked sites. You can then use the **wigle-pos.sh** script to geolocate the cracked networks using Wigle. For this, you'll need to also put your Wigle API key in the creds.txt file. **wigle-pos.sh** then outputs files that are ready to be imported into our system.

## Using our web interface
When you login with your credentials, you can click Visit on the WiFi Map tab. This will take you to the OpenStreetMaps Leaflet, that shows all cracked networks in our database. Under the map, you'll see some statistics and an ESSID filter. The web frontend is in a very early stage of development and many more features and improvements are on the way. Be sure to watch changelog for updates!

## Using our Android app
The app made by vojta-horanek is very simple. In the first tab, you'll see a list of "Nearby" networks, which esentially checks if the mac address of any WiFi network scanned by your Android smartphone corresponds to one in our database. In the second tab, you can search the networks by either ESSID, BSSID or their PSK. The Map function and settings are coming soon.