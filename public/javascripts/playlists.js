'use strict';

document.addEventListener('DOMContentLoaded', function () {
  const deleteBtns = document.querySelectorAll('.delete-button');
  deleteBtns.forEach(btn => {
    btn.addEventListener('click', function () {
      if (confirm("Are you sure you want to delete?")) {
        //Delete the playlist from the db
        //remove the parent div from the playlistContainer
        const playlist = btn.parentElement.parentElement;
        playlist.remove();
      }
    });
  });
});