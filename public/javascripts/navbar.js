'use strict';

document.addEventListener('DOMContentLoaded', function() {
  const menuIcon = document.querySelector('.menu-icon');
  const dropdown = document.querySelector('.dropdown');

  // Function to hide the dropdown
  function hideDropdown() {
      dropdown.style.display = 'none';
  }

  // Initially hide the dropdown
  hideDropdown();

  // Toggle dropdown on menu icon click
  menuIcon.addEventListener('click', function() {
      if (dropdown.style.display === 'none') {
          dropdown.style.display = 'block';
      } else {
          hideDropdown();
      }
  });

  // Hide dropdown when scrolling
  window.addEventListener('scroll', hideDropdown);

  // Hide dropdown when window is resized
  window.addEventListener('resize', hideDropdown);
});