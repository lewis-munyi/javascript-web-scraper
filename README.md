
<p align="center">
  <a href="https://example.com/">
    <img src="https://source.unsplash.com/SyzQ5aByJnE/200x200">
  </a>
</p>
<p align="center">
  <h2 align="center">Bikozulu Bot</h2>
</p>

<p align="center">
    A Node.js application that scraps posts off <a href="https://bikozulu.co.ke">Bikozulu</a>'s blog and sends them to users subscribed to a <a href="">Telegram bot</a>.
</p>

<p align="center">
<a href="https://www.buymeacoffee.com/lewismunyi" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/default-orange.png" alt="Buy Me A Coffee" style="height: 51px !important;width: 217px !important;" ></a>
</p>


## Table of contents

- [Getting started](#getting-started)
- [Prerequisites](#prerequisites)
- [Installing](#installing)
- [Running the app](#running-the-app)
    - [Running the web scraper](#running-the-web-scraper)
    - [Running cloud functions](#running-cloud-functions)
- [Deployment](#deployment)
- [Built With](#built-with)
- [Versioning](#versioning)
- [Authors](#authors)
- [License](#license)
- [Acknowledgments](#acknowledgments)
# Bikozulu Bot



## Getting Started

These instructions will get you a copy of the project up and running on your local machine for development and testing purposes. See deployment for notes on how to deploy the project on a live system.

### Prerequisites

You will need these to run and set up the app
* A [firebase]('https://firebase.google.com/) account. 
* [Node.js]('https://nodejs.org) installed on your PC

### Installing

1. Clone or download the repo from [this]("https://github.com/lewis-munyi/javascript-web-scraper/") url and extract it.

2. Open your console and change into that directory
    ```
   cd javascript-web-scraper/
   ```
3. List the contents of the directory.
    ```
    ls
    ```
4. You should have such a directory structure
   ```
   javascript-web-scraper/
   └── functions/
   │   ├── index.js
   │   │── ...
   │   │── ...
   │   └── package.json
   |── firebase.json           
   |── .gitignore
   |── firestore.rules           
   |── ...
   |── ...     
   |── index.js
   └── package.json
   ```
   
  5. Install the required modules
      ```
      npm install
      ```
  6. Install the required modules for cloud functions
       ```
       cd functions/
       npm install 
       ```
 7. Create a `.env` file at the root of your directory and add the following variables:
       ```
        API_KEY: "",
        AUTH_DOMAIN: "",
        DATABASE_URL: "",
        PROJECT_ID: "",
        STORAGE_BUCKET: "",
        MESSAGING_SENDING_ID: "",
        APP_ID: "",
        MEASUREMENT_ID: ""
     ```
8. Sign into your console and open the app you created. Get the config object for your web app and copy-paste the details into the respective fields in yout `.env` file. Follow [this tutorial]('https://support.google.com/firebase/answer/7015592) if you have trouble getting them. 
9. Retrieve your Javascript SDK for firebase and copy it to the root of your project. Use [this]("https://firebase.google.com/docs/admin/setup/#add-sdk") tutorial.
10. Rename the firebase admin credentials that you have just downloaded to `firebase-adminsdk.json`


## Running the app

The app is split into two parts;
* A web scraping application that scraps data and stores it in Cloud firestore
* Cloud functions that are triggered and run when updating the Telegram bot. 

### Running the web scraper

1. From the root(`/`) directory, run 
    ```
    npm run start
   ```
2. You should see such a screen

<p align-center>
    <img src="https://raw.githubusercontent.com/lewis-munyi/javascript-web-scraper/master/images/Homescreen.png" alt="Logo">
</p>

Yaay! It works.

### Running cloud functions

1. Navigate into your `functions/` directory
    ```
    cd functions/
   ```
2. Run 
    ```
    npm run serve
    ```
That's it

## Deployment

1. `cd` into the root  `/` directory
    ```
   # If you are in the functions directory
    cd ../
    ```
2. run 
    ```
    firebase deploy
    ```

## Built With

* [Nuxt](https://nuxtjs.org/) - The web framework used
* [Firebase](https://firebase.google.com/) - Cloud functions + storage + auth
* [Telegram](https://telegram.org/) - Bot platform

## Contributing

Currently accepting pull requests.

## Authors

* **Lewis Munyi** - *Dev* - [Website](https://lewismunyi.web.app)

See also the list of [contributors](https://github.com/lewis-munyi/javascript-web-scraper/tree/contributors) who participated in this project.

## License

This project is licensed under the GNU General Public License v3.0 License - see the [LICENSE](LICENSE) file for details

## Acknowledgments

* Hat tip to anyone whose code was used

Enjoy :metal:
