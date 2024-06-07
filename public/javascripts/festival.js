'use strict';

document.addEventListener('DOMContentLoaded', function () {
  const festivalContainer = document.querySelector('.festival-artist-container');
  const playlistContainer = document.querySelector('.playlist-artist-container');
  const addAllButton = document.getElementById('add-all');
  const removeAllButton = document.getElementById('remove-all');
  const submitButton = document.getElementById('submit-playlist');

  if(submitButton){

    submitButton.addEventListener('click', function () {
      const artistDivs = playlistContainer.querySelectorAll('.artist');
      const artistIds = Array.from(artistDivs).map(div => div.getAttribute('artist-id'));

      if (artistIds.length === 0) {
        alert('You must add at least one artist to the playlist');
        return;
      }
      // Create trackCounts array based on the value of each track count input
      const trackCounts = Array.from(artistDivs).map(div => {
        const input = div.querySelector('.track-count');
        return input ? parseInt(input.value, 10) : 1; // Default to 1 if input is not found
      });

      document.getElementById("generating-loader").style.display = 'flex';
      document.getElementById("submit-playlist").style.display = 'none';
      const festivalName = document.getElementById('festival-name-header').innerText;

      const data = {
        artistIds: artistIds,
        trackCounts: trackCounts,
        festivalName: festivalName
      };



      fetch('/festivals/{{ user.id }}', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
      })
        .then(response => response.json())
        .then(data => {
          console.log('Success:', data);
          // Handle success response
          document.getElementById("generating-loader").innerHTML = "Success!";
        })
        .catch((error) => {
          console.error('Error:', error);
          document.getElementById("generating-loader").innerHTML = "Error :(";
          // Handle errors
        });
    });
  }


  // Function to handle scroll over artist div
  function handleArtistScroll(scrollEvent, artistDiv) {
    scrollEvent.preventDefault();
    const trackCountInput = artistDiv.querySelector('.track-count');

    if (trackCountInput) {
      let currentValue = parseInt(trackCountInput.value, 10) || 1;

      if (scrollEvent.deltaY < 0 && currentValue < 10) { // Scrolling up
        trackCountInput.value = currentValue + 1;
      } else { // Scrolling down
        trackCountInput.value = currentValue - 1;
      }
    }
  }
  // Function to add a track count input to an artist div
  function addTrackCountInput(artistDiv) {
    const multipleTrackCountInput = document.getElementById('track-count-multiple').value;

    const trackCountInput = document.createElement('input');
    trackCountInput.type = 'number';
    trackCountInput.className = 'track-count';
    trackCountInput.value = multipleTrackCountInput === 'random' ?
        Math.floor(Math.random() * 10) + 1 : multipleTrackCountInput;
    trackCountInput.min = '1';
    trackCountInput.max = '10';

    trackCountInput.addEventListener('input', function () {
      // Remove any non-digit characters
      this.value = this.value.replace(/\D/g, '');
    });

    trackCountInput.addEventListener('change', function () {
      const value = parseInt(this.value, 10) || 1;
      this.value = Math.max(1, Math.min(value, 10));
    });

    // Event listener for the wheel event on the track count input
    trackCountInput.addEventListener('wheel', function (scrollEvent) {
      handleArtistScroll(scrollEvent, artistDiv);
    }, { passive: false });

    artistDiv.appendChild(trackCountInput);
  }

  // Function to remove a track count input from an artist div
  function removeTrackCountInput(artistDiv) {
    const trackCountInput = artistDiv.querySelector('.track-count');
    if (trackCountInput) {
      artistDiv.removeChild(trackCountInput);
    }
  }




  // Function to move an artist to the playlist container
  festivalContainer.addEventListener('click', function (event) {
    if (event.target.classList.contains('artist')) {
      playlistContainer.appendChild(event.target);
      addTrackCountInput(event.target);
    }
  });

  // Function to move an artist back to the festival container
  playlistContainer.addEventListener('click', function (event) {
    if (event.target.classList.contains('artist')) {
      festivalContainer.prepend(event.target);
      removeTrackCountInput(event.target);
    }
  });

  // Function to move all artists to the playlist container
  addAllButton.addEventListener('click', function () {
    const allArtists = Array.from(festivalContainer.getElementsByClassName('artist'));
    allArtists.forEach(artist => {
      playlistContainer.appendChild(artist);
      addTrackCountInput(artist);
    });
  });

  // Function to move all artists back to the festival container
  removeAllButton.addEventListener('click', function () {
    const allArtists = Array.from(playlistContainer.getElementsByClassName('artist'));
    allArtists.forEach(artist => {
      removeTrackCountInput(artist);
      festivalContainer.appendChild(artist);
    });
  });
});