//           //
// variables //
//           //

var metEndpoint = 'https://collectionapi.metmuseum.org/public/collection/v1/';
var metDepts = [];
var metSearchResults = {};
var metArtObj = {};
var artObjCache = []; // holds cacheItemsNum amount of pre-fetched metArtObj's
var cacheItemsNum = 10;
var displayArtObj = {};
var nextArtObj = {};

// DOM objects
var $topLogo = document.querySelector('#top-logo');
var $showSomething = document.querySelector('#show-something');
var $displayImage = document.querySelector('#display-image');
var $dislikeButton = document.querySelector('#dislike-button');
var $likeButton = document.querySelector('#like-button');
var $bottomSheetGallery = document.querySelector('#bottom-sheet-gallery');

//                 //
// event listeners //
//                 //

// Logo text switches to landing view
$topLogo.addEventListener('click', function (event) {
  swapView(event.target.dataset.viewLink);
});

// Show Something button switches to selection view
$showSomething.addEventListener('click', function (event) {
  // (future optimization point)
  // When clicked, grab one and set it immediately
  getArtwork(true); // passing true to isStart parameter
  swapView(event.target.dataset.viewLink);
  // Then start building cache of images
  for (var i = 1; i <= cacheItemsNum; i++) {
    // console.log('building cache, item #: ', i);
    getArtwork();
  }
});

$dislikeButton.addEventListener('click', function (event) {
  // categorize displayed one as dislike
  data.dislikedObjects.push(displayArtObj);
  // retrieve the next from cache list
  nextArtObj = artObjCache.shift();
  // fetch another artwork to replace the missing one
  getArtwork();
  // show the next object while the next artwork is being fetched
  setImage(nextArtObj);
});

$likeButton.addEventListener('click', function (event) {
  data.likedObjects.push(displayArtObj);
  nextArtObj = artObjCache.shift();
  getArtwork();
  setImage(nextArtObj);
});

//           //
// functions //
//           //

// Swap view
function swapView(dataView) {
  var $views = document.querySelectorAll('[data-view]');
  for (var vwIdx = 0; vwIdx < $views.length; vwIdx++) {
    if ($views[vwIdx].dataset.view === dataView) {
      $views[vwIdx].classList.remove('hidden');
    } else {
      $views[vwIdx].classList.add('hidden');
    }
  }
}

// Fisher–Yates shuffle, guide from https://bost.ocks.org/mike/shuffle/
function shuffleArray(array) {
  /*
  Shuffles an array by creating a "front side of the deck" and a "back side of the deck."
  Array begins with all items in the front and 0 in the back.
  Item is picked randomly from the front of the deck (i).
  This item is then swapped with the first item in the "back side"
    Putting the first element into the "back side", our shuffled array begins
  Now our "front side" is smaller by one element, and we pick another random item from this smaller "front"
  Repeat the swapping process until we have removed everything from the front side and they are all in the back side
    The back side is assembled by randomly picking, so we have a shuffled array!
  (Number of values in the array could potentially be large, so I had to
    outsource the sorting algorithm)

  Create a copy of the array to work on
  Create a variable to store the index of the end of the front size of the array
    Assign it the length of the array to start out (It will be incremented down on first iteration, so it should be .length)
  Create placeholder variable for the array item index that will be drawn
  Create placeholder variable for the array item at the end of the front side that will be replaced
  While iterating our place downwards from the end of the array to index 0
    Get an index that can be anywhere from index 0 to the end of the front
    Store the item at the last index of the front side of the array in a variable
    Set the item at the last index of the front side of the array to the value at the picked index
    Set the value at the picked index to the item that was at the end of the front side
  return the array
  */

  var arrayCopy = array.slice();
  var m = arrayCopy.length;
  var i;
  var t;

  while (m > 0) {
    // Pick from the front side of the array
    i = Math.floor(Math.random() * m--);
    // Item at the end of the front side will be replaced, so save it
    t = arrayCopy[m];
    // Put our picked item at the end of the front side
    arrayCopy[m] = arrayCopy[i];
    // We need to put the item from the end back in, put it where we got our picked item
    arrayCopy[i] = t;
  }

  return arrayCopy;
}

//                                //
// Metropolitan Museum of Art API //
//                                //

function getMetDepartments() {
  var deptXhr = new XMLHttpRequest();
  deptXhr.open('GET', metEndpoint + 'departments');
  deptXhr.responseType = 'json';
  deptXhr.addEventListener('load', function (event) {
    metDepts = deptXhr.response.departments;
  });
  deptXhr.send();
}

// Functions for searching and returning art objects

function metSearch(deptId, query) {
  // sets up the XHR but still waiting for onload function and sending
  var getUrl = '';
  if (query !== undefined) {
    getUrl = metEndpoint + 'search?' +
      'hasImages=true' +
      '&departmentId=' + deptId +
      '&q=' + query;
  } else {
    getUrl = metEndpoint + 'objects?departmentIds=' + deptId;
  }
  var searchXhr = new XMLHttpRequest();
  searchXhr.open('GET', getUrl);
  searchXhr.responseType = 'json';

  return searchXhr;
}

function metAcquireArt(objectId) {
  // sets up the XHR but still waiting for onload function and sending
  var acquireXhr = new XMLHttpRequest();
  acquireXhr.open('GET', metEndpoint + 'objects/' + objectId);
  acquireXhr.responseType = 'json';

  return acquireXhr;
}

function handleAcquireResponse(acquireRequest, isStart, searchResultsIdx, searchRequest) {
  /*
  handleAcquireResponse:
    (runs once acquireRequest has loaded)
  Get the response and store it in metArtObj
  Store the objectID in data.shownObjectIds to keep track of what has been checked already
  Check if metArtObj has an image URL
    Check if we're at the start (clicked button starting the selection, not a like/dislike)
      If so,
        Set the image to the URL
      If we're not at the start
        Push this object into the preload cache
    If it doesn't have a URL
      Increment the index (e.g. from the 0th item to the 1st item)
      Call this function again with the new index

  Variable sources:
  acquireRequest - passed in from handleSearchResponse()
  searchRequest - passed in from handleSearchResponse() from getArtwork()
  searchResultsIdx - passed in from handleSearchResponse() from getArtwork()
  isStart - passed in from handleSearchResponse() from getArtwork()
  metArtObj - global
  data - global
  artObjCache - global
  */
  metArtObj = acquireRequest.response;
  // Store the acquired object ID so we know we've seen it already
  data.shownObjectIds.push(metArtObj.objectID);
  if (metArtObj.primaryImage !== '') {
    if (isStart) {
      // If this is the first time running, go straight to showing it rather than caching it
      setImage(metArtObj);
    } else {
      artObjCache.push(metArtObj);
    }
  } else {
    searchResultsIdx++;
    handleSearchResponse(searchRequest, searchResultsIdx, isStart); // This will use the new value of searchResultsIdx since handleSearchResponse calls searchResultsIdx from a higher scope than itself
  }
}

function handleSearchResponse(searchRequest, searchResultsIdx, isStart, areResultsShuffled) {
  /*
  handleSearchResponse:
    (runs once searchRequest has loaded)
  Check that the index isn't >= objectIDs.length
    If it is, then we have reached the end of the array of objects
      return false, and handle the false outside
    If it isn't, then proceed
  Check if the item at searchResultsIdx has already been shown before
    If it has been shown, grab the next item in objectIDs and check again
  Set up a request for the item at searchResultsIdx in objectIDs
  Here's what should happen when it's done loading
    Call handleAcquireResponse
  Now send the request and let's see what happens

  Variable sources:
  searchRequest - passed in from getArtwork()
  searchResultsIdx - passed in from getArtwork()
  isStart - pass in from getArtwork()
  currentObjId - created in this function
  acquireRequest - created in this function
  metSearchResults - global
  data - global
  */

  metSearchResults = searchRequest.response;
  // Prevent reshuffling
  if (areResultsShuffled === false) {
    metSearchResults.objectIDs = shuffleArray(metSearchResults.objectIDs);
    areResultsShuffled = true;
  }
  if (metSearchResults.objectIDs === null) {
    // if results were bad, exit for now
    return;
  } else if (searchResultsIdx >= metSearchResults.objectIDs.length) {
    // if we exhausted the list of id's, pull again
    getArtwork();
  }

  var currentObjId = metSearchResults.objectIDs[searchResultsIdx];
  // if this artwork been shown already, skip it
  while (data.shownObjectIds.includes(currentObjId)) {
    searchResultsIdx++;
    currentObjId = metSearchResults.objectIDs[searchResultsIdx];
  }

  // Now that we have a new, never before seen currentObjId, we can attempt to acquire it.
  var acquireRequest = metAcquireArt(currentObjId);
  acquireRequest.addEventListener('load', function (event) {
    handleAcquireResponse(acquireRequest, isStart, searchResultsIdx, searchRequest);
  });
  acquireRequest.send();
}

function getArtwork(isStart) {
  /*
  getArtwork:
    (runs when any of the three main buttons are clicked)
  This function calls the functions that get artwork and put them into the artObjCache
  if they have an accessible URL. When isStart=true, the artwork will be immediately displayed
  and not put into artObjCache

  > note: assuming that an entire department will always have at least one object with an accessible image
    aka, we will never reach the end of the objectIDs array
    This will **not** hold true when the results are more narrow

  Check if the preload cache has enough objects
    If so, don't run this
  Get the index for a random department
  Set up a search request for the random department
  Instantiate an index i at 0 for going through the array of results
  Set up a load event listener for the search results to handle the response when it arrives
  Send the request
  */
  if (artObjCache.length >= cacheItemsNum) {
    // Don't keep sending requests if the cache is full, prevent button spamming to abuse API
    return;
  }
  var randDept = Math.floor(Math.random() * metDepts.length);
  // Department id's are not continuous, some are missing (from 1 - 21, 2 and 20 are missing). Access by index
  var searchRequest = metSearch(metDepts[randDept].departmentId);
  var searchResultsIdx = 0; // this is declared outside of the search results, making it suitable for iterating through search results
  var areResultsShuffled = false;
  searchRequest.addEventListener('load', function (event) {
    handleSearchResponse(searchRequest, searchResultsIdx, isStart, areResultsShuffled);
  });
  searchRequest.send();
}

function addImageToImg(artObj, $img) {
  // Note: Modifies the passed in $img

  var objectName = (artObj.objectName === '') ? 'Untitled' : artObj.objectName;
  var artistName = (artObj.artistDisplayName === '') ? 'Unknown' : artObj.artistDisplayName;
  var objectDate = (artObj.objectDate === '') ? 'Unknown Date' : String(artObj.objectDate);
  var altString = objectName + ' by ' + artistName + ' (' + objectDate + ')';

  $img.setAttribute('src', artObj.primaryImageSmall);
  $img.setAttribute('alt', altString);
}

function setImage(artObj) {
  displayArtObj = artObj;
  addImageToImg(artObj, $displayImage);
}

function renderImage(artObj) {
  var $imageContainer = document.createElement('div');
  $imageContainer.className = 'img-gallery-container col-1-3 flex-col jc-center ai-center';
  $imageContainer.setAttribute('data-objectid', artObj.objectID);

  var $image = document.createElement('img');
  addImageToImg(artObj, $image);

  $imageContainer.appendChild($image);

  return $imageContainer;
}

function appendImageToGallery($imgContainer, $gallery) {
  $gallery.appendChild($imgContainer);
}

function renderAllLiked() {
  // function to append all liked images to the gallery
  // Clear any children nodes
  $bottomSheetGallery.replaceChildren();

  for (var i = 0; i < data.likedObjects.length; i++) {
    var $imageContainer = renderImage(data.likedObjects[i]);
    appendImageToGallery($imageContainer, $bottomSheetGallery);
  }
}

//           //
// Execution //
//           //

// Get departments, assuming departments will not change in single session
// but may change in the future.
renderAllLiked();
getMetDepartments();
