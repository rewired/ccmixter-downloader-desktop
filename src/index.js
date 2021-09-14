const { app, BrowserWindow, dialog, ipcMain} = require('electron');
const path = require('path');
const url = require('url');
const http = require('http');
const slug = require('slug');
const Downloader = require('nodejs-file-downloader');
const Store = require('./store.js');
const querystring = require('querystring');

let songInfo = {};
let trackList = {};

let libraryPath = "";
let mainWindow;

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
  options.webPreferences = {
    nodeIntegration: true,
    contextIsolation: false
  };

  // Create the browser window.
  const mainWindow = new BrowserWindow(options);

  mainWindow.on('resize', () => {
    let { width, height } = mainWindow.getBounds();
    store.set('windowBounds', { width, height });
  });

  let params = new URLSearchParams('library_path=' + libraryPath);
  
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


const getSongInfo = (url, e) => {
  const ccMixterId = url.split('/').pop();
  const ccMixterSongInfoURL = "http://ccmixter.org/api/query/api?ids=http://ccmixter.org/api/query?f=m3u&ids=" + ccMixterId + "&f=json";

  //console.log(ccMixterSongInfoURL);

  http.get(ccMixterSongInfoURL, function(res){
    var body = '';
    trackList = {};

    res.on('data', function(chunk){
      body += chunk;
    });

    res.on('end', function(){
      var response = JSON.parse(body);
      res = response[0];
      // console.log(response[0]);
      songInfo.title = res.upload_name;
      songInfo.artist = res.user_name;
      songInfo.bpm = res.upload_extra.bpm;

      //console.log(songInfo);

      for(var i = 0; i < res.files.length; i++) {
        let trackInfo = {
          fileName: res.files[i].file_name,
          fileNiceName: res.files[i].file_nicname,
          fileId: res.files[i].file_id,
          trackId: res.files[i].file_upload,
          downloadURL: res.files[i].download_url,
          fileSize: res.files[i].file_rawsize
        }
        trackList[trackInfo.fileId] = trackInfo;

        e.sender.send('add-file', trackInfo);
      }
    });
  }).on('error', function(e){
    //@todo: error handling
    console.log("Got an error: ", e);
  });

}


const downloadFromUrl = (e, sInfo, cFile) => {
  var newFilename = slug(sInfo.artist.toString()) + '_' + slug(sInfo.title.toString()) + '_' + slug(cFile.fileNiceName.toString()) + '[' + sInfo.bpm + ']' + path.extname(cFile.fileName);

  ( async () => {
    const downloader = new Downloader({
      url: cFile.downloadURL,
      directory: libraryPath + "/" + slug(sInfo.artist.toString()) + "/" + slug(sInfo.title.toString()) + " [" + sInfo.bpm + "]",
      fileName: newFilename,
      onProgress: (percentage,chunk,remainingSize) => {
        var progressInfo = {};
        progressInfo.id = cFile.fileId;
        progressInfo.value = percentage;

        e.sender.send('progress', progressInfo);

      }
    })

    try {
      await downloader.download();
      // handle "done"
      //console.log("done: " + newFilename)  
    } catch (error) {
       console.log(error)
    } 
  })(); 
}

ipcMain.on("fetch-json-from-url",(e, url)=>{
  getSongInfo(url, e);
});

ipcMain.on("download", (e, files) => {
  for (var i = 0; i < files.length; i++) {
    var cur = trackList[files[i]];
    downloadFromUrl(e, songInfo, cur);
  }
});

ipcMain.on("select-library-path", async (e, curPath) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });

  libraryPath = result.filePaths;
  store.set('libraryPath', libraryPath.toString());

  e.sender.send('library-path-updated', libraryPath);
});