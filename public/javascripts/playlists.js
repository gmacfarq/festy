'use strict';

document.addEventListener('DOMContentLoaded', function () {
  const deleteBtns = document.querySelectorAll('.delete-button');
  deleteBtns.forEach(btn => {
    btn.addEventListener('click', function () {
      if (confirm("Are you sure you want to delete?")) {
        //Delete the playlist from the db
        //remove the parent div from the playlistContainer
        const data = {
          spotifyId: btn.getAttribute('spotify-id'),
          playlistId: btn.getAttribute('playlist-id')
        };
        fetch('/playlists/delete', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data)
        })
          .then(response => response.json())
          .then(data => {
            console.log('Success:', data);
          })
          .catch((error) => {
            console.error('Error:', error);
          });

        const playlist = btn.parentElement.parentElement;
        playlist.remove();
      }
    });
  });
});