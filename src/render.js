let $ = jQuery = require("jquery");
let numeral = require("numeral");
const {ipcRenderer} = require("electron");

const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);

let number_of_files = 0;

$("#library-form").on("submit", (e) => {
    e.preventDefault();
    ipcRenderer.send("select-library-path", $("#library_path").val());
});

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
    console.log('number_of_files: ' + number_of_files);

    ipcRenderer.send("download", files);
});

$("#btnAbortDownload").on("click", (e) => {
    e.preventDefault();
    $('#song').show();
    $('#btnDownload').show();
    $('#stems').hide();
});

ipcRenderer.on('add-file', (event, songInfo) => {
    //console.log(songInfo);

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
        /*
        "<td><span id=\"progress-",
        songInfo.fileId,
        "\"><br /></span></td>"
        */
        "</tr>"
        ].join(''));

    if($('#filelist').children().length > 0){
        $('#stems').show();
    }

    $('#loading').hide();
 });

ipcRenderer.on('progress', (event, progressInfo) => {
    //console.log('#progress-' + progressInfo.id + ' ->' + numeral(progressInfo.value).format('0.00') + '%');
    let num = numeral(progressInfo.value).format('0.00');
    pbar = $('#progress-' + progressInfo.id);
    pbar.html(num + '%');
    pbar.width(num);

    if(num == '100.00') {
        number_of_files--;
        console.log('number_of_files: ' + number_of_files);
        if(number_of_files == 0) {
            $('#btnAbortDownload').show();
            $('#download-in-progress').hide();
        }
    }
});

ipcRenderer.on('library-path-updated', (event, lpath) => {
    if(lpath != "") {
        $("#library_path").val(lpath);
        $('#btnCheck').prop('disabled', false);
        $('#btnDownload').prop('disabled', false);
    }
});

$('#song').show();
$('#stems').hide();
$('#loading').hide();
$('#download-in-progress').hide();

let library_path = urlParams.get('library_path');
if( library_path != '' ) {
    $("#library_path").val(library_path);
    $('#btnDownload').prop('disabled', false);
} else {
    $('#btnCheck').prop('disabled', true);
    $('#btnDownload').prop('disabled', true);
}