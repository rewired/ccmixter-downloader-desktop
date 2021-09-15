let $ = jQuery = require("jquery");
require('bootstrap');

let numeral = require("numeral");
const {ipcRenderer} = require("electron");

const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);

let number_of_files = 0;

const isURL = (url) => {
    const regex = /((([A-Za-z]{3,9}:(?:\/\/)?)(?:[-;:&=\+\$,\w]+@)?[A-Za-z0-9.-]+|(?:www.|[-;:&=\+\$,\w]+@)[A-Za-z0-9.-]+)((?:\/[\+~%\/.\w-_]*)?\??(?:[-\+=&;%@.\w_]*)#?(?:[.\!\/\\w]*))?)/ig;
    let result = regex.exec(url) !== null;
    return result;
};

const checkURL = () => {
    if(isURL($("#url").val())) {
        $('#btnCheck').prop('disabled', false);
    } else {
        $('#btnCheck').prop('disabled', true);
    }
};

$("#library-form").on("submit", (e) => {
    e.preventDefault();
    ipcRenderer.send("preferences:select-library-path", $("#library_path").val());
});

$("#url").on("keyup paste blur focus", (e) => {
    checkURL();
});

$("#song").on("submit", (e) => {
    e.preventDefault();
    $('#loading').show();

    let url = $("#url").val();

    $('#stems').hide();
    $('#song').hide();
    $('#filelist').html("");

    ipcRenderer.send("song-info:fetch-json", url);
});

$("#download").on("submit", (e) => {
    e.preventDefault();

    $("#btnDownload").hide();
    $('#download-in-progress').show();
    $("input[type=checkbox]").prop('disabled', true);

    let files = [];

    let formData = $("#download input:checked");
    for(var i = 0; i < formData.length; i++) {
        files.push( $(formData[i]).val() );
    }

    $('#btnAbortDownload').hide();

    number_of_files = formData.length;
    ipcRenderer.send("download:start", files);
});

$("#btnAbortDownload").on("click", (e) => {
    e.preventDefault();
    $('#song').show();
    $('#btnDownload').show();
    $('#stems').hide();
});

ipcRenderer.on('song-info:add-file', (event, songInfo) => {
    $('#filelist').append([
        "<tr><td><input id=\"",
        songInfo.fileId,
        "\" type=\"checkbox\" value=\"",
        songInfo.fileId,
        "\" checked=\"checked\" /></td><td>",
        songInfo.fileName,
        "</td><td>" + numeral(songInfo.fileSize).format('0.00b'),
        "</td><td><div class=\"progress\" style=\"width:8em;margin-top:5px;margin-right:5px;\"><div class=\"progress-bar\" role=\"progressbar\" aria-valuenow=\"0\" aria-valuemin=\"0\" aria-valuemax=\"100\" id=\"progress-",
        songInfo.fileId,
        "\">",
        "</div></div></td>",
        "</tr>"
        ].join(''));

    if($('#filelist').children().length > 0){
        $('#stems').show();
    }

    $('#loading').hide();
 });

ipcRenderer.on('song-info:error', (event, errorDiscription) => {
    // further error handling required
    $('#song').show();
    $('#loading').hide();
});

ipcRenderer.on('download:progress', (event, progressInfo) => {

    let num = numeral(progressInfo.value).format('0.00');
    pbar = $('#progress-' + progressInfo.id);
    pbar.html(num + '%');
    pbar.width(num);

    if(num == '100.00') {
        number_of_files--;
        if(number_of_files == 0) {
            $('#btnAbortDownload').show();
            $('#download-in-progress').hide();
        }
    }
});

ipcRenderer.on('preferences:library-path-set', (event, lpath) => {
    if(lpath != "") {
        $("#library_path").val(lpath);
        $('#btnCheck').prop('disabled', false);
        $('#btnDownload').prop('disabled', false);
    }
});

// ------------------------------------------------------------------------------------

$('#song').show();
$('#stems').hide();
$('#loading').hide();
$('#download-in-progress').hide();
$('#btnCheck').prop('disabled', true);

let library_path = urlParams.get('library_path');
if( library_path != '' ) {
    $("#library_path").val(library_path);
    $('#btnDownload').prop('disabled', false);
} else {
    $('#btnCheck').prop('disabled', true);
    $('#btnDownload').prop('disabled', true);
}

$(".example-link").on("click", (e) => {
    $("#url").val(($(e.target).html()));
    $("#url").fadeOut(200).fadeIn(200).fadeOut(200).fadeIn(200);
    checkURL();
});

$(".copyright-toggle").on("click", (e) => {
    $("#copyright").modal("toggle");
});

$("#open-folder-in-os").on("click", (e) => {
    ipcRenderer.send("library:open-folder", $("#library_path").val());
});