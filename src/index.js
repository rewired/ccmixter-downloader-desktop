const { app, BrowserWindow, dialog, ipcMain} = require('electron');
const path = require('path');
const url = require('url');
const http = require('http');
const slug = require('slug');
const Downloader = require('nodejs-file-downloader');
const Store = require('./store.js');
const { shell } = require('electron');
const axios = require('axios');
const DecompressZip = require('decompress-zip');

let songInfo = {};
let trackList = {};

let libraryPath = "";
let mainWindow;

// check for preferences or set defaults
const store = new Store({
  configName: 'user-preferences',
  defaults: {
    libraryPath: "",
    windowBounds: {width: 1200, height: 800}
  }
});

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) { // eslint-disable-line global-require
  app.quit();
}

const createWindow = (options, libpath) => {
  options.autoHideMenuBar = true;
  options.titleBarStyle = 'hidden';
  options.minWidth = 1200;
  options.minHeight = 800;
  options.fullscreenable = false;
  options.fullscreen = false;
  options.maximizable = false;
  options.titleBarOverlay = {
    color: '#1c1c1c',
    symbolColor: '#fff'
  };
  options.webPreferences = {
    nodeIntegration: true,
    contextIsolation: false
  };

  // Create the browser window.
  const mainWindow = new BrowserWindow(options);

  let params = new URLSearchParams('library_path=' + libraryPath);

  mainWindow.on('resize', () => {
    let { width, height } = mainWindow.getBounds();
    store.set('windowBounds', { width, height });
  });

  mainWindow.on('maximize', () => {
    mainWindow.unmaximize();
  });

  // and load the index.html of the app.
  mainWindow.loadURL(url.format ({
    pathname: path.join(__dirname, 'index.html'),
    search: '?' + params.toString(),
    protocol: 'file:',
    slashes: true
  }));

  // Open the DevTools.
  mainWindow.webContents.openDevTools();
};

app.on("ready", () => {
  windowSize = store.get('windowBounds');
  libraryPath = store.get('libraryPath');
  createWindow(windowSize, libraryPath);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    windowSize = store.get('windowBounds');
    createWindow(windowSize, libraryPath);
  }
});

const getAcappellas = (e) => {
  /*
  URL: http://ccmixter.org/api/queries?items=reqtags%3Dfeatured%252Cacappella%252C-autoplay%252Cbpm_070_075%26limit%3D10%26lic%3Dall%26dataview%3Ddefault%26offset%3D0%26f%3Djsex&total=f%3Dcount
  hints:
  %26   : '&'
  %3D   : '='
  %252C : ',' (double encoded)
                                             reqtags=featured,acappella,-autoplay,bpm_07_075&lic=all&dataview=default&offset=0&f=jsex&total=f=count
  */
};

const getSongInfo = (url, e) => {

  const ccMixterId = url.split('/').pop();
  const ccMixterSongInfoURL = "http://ccmixter.org/api/query/api?ids=http://ccmixter.org/api/query?f=m3u&ids=" + ccMixterId + "&f=json";
  trackList = {};
  let errorMsg = '';

  axios.get(ccMixterSongInfoURL)
  .then((response) => {
    if(response.status == '200') {
      let res = response.data[0];

      songInfo.title = res.upload_name;
      songInfo.artist = res.user_name;
      songInfo.bpm = res.upload_extra.bpm;

      for(var i = 0; i < res.files.length; i++) {
        let trackInfo = {
          fileName: res.files[i].file_name,
          fileNiceName: res.files[i].file_nicname,
          fileId: res.files[i].file_id,
          trackId: res.files[i].file_upload,
          downloadURL: res.files[i].download_url,
          fileSize: res.files[i].file_rawsize,
          fileInfo: res.files[i].file_format_info
        }
        trackList[trackInfo.fileId] = trackInfo;

        e.sender.send('song-info:add-file', trackInfo);
      }
    } else {
      e.sender.send('song-info:error', 'Failed');
    }
  })
  .catch(error => {
    e.sender.send('song-info:error', 'Failed');
  });
};

const downloadFromUrl = (e, sInfo, cFile) => {

  var newFilename = slug(sInfo.artist.toString()) + '_' + slug(sInfo.title.toString()) + '_' + slug(cFile.fileNiceName.toString()) + '[' + sInfo.bpm + ']' + path.extname(cFile.fileName);
  var destination = libraryPath + "/" + slug(sInfo.artist.toString()) + "/" + slug(sInfo.title.toString()) + " [" + sInfo.bpm + "]";

  ( async () => {
    const downloader = new Downloader({
      url: cFile.downloadURL,
      directory: destination,
      fileName: newFilename,
      onProgress: (percentage,chunk,remainingSize) => {
        var progressInfo = {};
        progressInfo.id = cFile.fileId;
        progressInfo.value = percentage;

        e.sender.send('download:progress', progressInfo);
      }
    })

    try {
      await downloader.download();
      // handle "done"
      console.log(cFile);
      if(cFile.fileInfo["media-type"] == "archive" && cFile.fileInfo["default-ext"] == "zip"){
        //console.log("done: " + destination + '/' + newFilename);
        let unzipper = new DecompressZip(destination + '/' + newFilename)

        unzipper.on('error', function (err) {
            console.log('Caught an error:', err);
        });
        unzipper.on('extract', function (log) {
            console.log('Finished extracting');
        });
        unzipper.on('progress', function (fileIndex, fileCount) {
            console.log('Extracted file ' + (fileIndex + 1) + ' of ' + fileCount);
        });

        unzipper.extract({
          path: destination + '/' + slug(sInfo.title.toString()) + '_' + slug(cFile.fileNiceName.toString()),
          restrict: false,
          filter: function (file) {
              return file.type !== "SymbolicLink";
          }
        });

      };
    } catch (error) {
       console.log(error);
    } 
  })(); 
}

ipcMain.on("song-info:fetch-json",(e, url)=>{
  getSongInfo(url, e);
});

ipcMain.on("download:start", (e, files) => {
  for (var i = 0; i < files.length; i++) {
    var cur = trackList[files[i]];
    downloadFromUrl(e, songInfo, cur);
  }
});

ipcMain.on("preferences:select-library-path", async (e, curPath) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });

  libraryPath = result.filePaths;
  store.set('libraryPath', libraryPath.toString());

  e.sender.send('preferences:library-path-set', libraryPath);
});

ipcMain.on("library:open-folder", (e, path) => {
  shell.showItemInFolder(path);
});