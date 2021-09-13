let $ = jQuery = require("jquery");
let numeral = require("numeral");
const {ipcRenderer} = require("electron");

const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);

$("#song").on("submit", (e) => {
    e.preventDefault();
    $('#loading').show();

    let url = $("#url").val();
    //console.log("URL", url);

    $('#stems').hide();
    $('#song').hide();
    $('#filelist').html("");

    ipcRenderer.send("fetch-json-from-url", url);
});

ipcRenderer.on('add-file', (event, songInfo) => {
    //console.log(songInfo);
    $('#filelist').append([
        "<li><input id=\"",
        songInfo.fileId,
        "\" type=\"checkbox\" value=\"",
        songInfo.fileId,
        "\" checked=\"checked\" /> ",
        songInfo.fileName,
        " (" + numeral(songInfo.fileSize).format('0.00b'),
        ") ",
        "<span id=\"progress-",
        songInfo.fileId,
        "\"></span>",
        "</li>"
        ].join(''));

    if($('#filelist').children().length > 0){
        $('#stems').show();
    }

    $('#loading').hide();
 });

ipcRenderer.on('progress', (event, progressInfo) => {
    $('#progress-' + progressInfo.id).html(numeral(progressInfo.value).format('0.00') + '%');
});

ipcRenderer.on('library-path-updated', (event, lpath) => {
    console.log(lpath);
    if(lpath != "") {
        $("#library_path").val(lpath);
        $('#btnCheck').prop('disabled', false);
    }
});

$("#library-form").on("submit", (e) => {
    e.preventDefault();
    ipcRenderer.send("select-library-path", $("#library_path").val());
});

$("#download").on("submit", (e) => {
    e.preventDefault();

    $("#btnDownload").hide();
    $("input[type=checkbox]").prop('disabled', true);

    let files = [];

    let formData = $("#download ul li input:checked");
    for(var i = 0; i < formData.length; i++) {
        files.push( $(formData[i]).val() );
    }

    ipcRenderer.send("download", files);
});

$("#btnAbortDownload").on("click", (e) => {
    e.preventDefault();
    $('#song').show();
    $('#btnDownload').show();
    $('#stems').hide();
});

$('#song').show();
$('#stems').hide();
$('#loading').hide();

let library_path = urlParams.get('library_path');
if( library_path != '' ) {
    $("#library_path").val(library_path);
} else {
    $('#btnCheck').prop('disabled', true);
}