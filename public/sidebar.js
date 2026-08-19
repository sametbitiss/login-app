/**
 * Enterprise ERP — Sidebar Accordion Navigation & Grouping
 */
(function () {
  function initSidebarAccordion() {
    var groupTitles = document.querySelectorAll('.mss-group-title');

    groupTitles.forEach(function (title) {
      // Locate the associated .mss-sub container for this group title
      var subMenu = title.nextElementSibling;
      while (subMenu && !subMenu.classList.contains('mss-sub') && !subMenu.classList.contains('mss-group-title')) {
        subMenu = subMenu.nextElementSibling;
      }

      if (subMenu && subMenu.classList.contains('mss-sub')) {
        // If subMenu contains active link, keep it open on page load
        var activeLink = subMenu.querySelector('.active, .mss-sub-link.active, .mss-link.active');
        if (activeLink) {
          subMenu.classList.add('open');
          title.classList.add('expanded');
        } else {
          subMenu.classList.remove('open');
          title.classList.remove('expanded');
        }

        // Add toggle click listener
        title.style.cursor = 'pointer';
        title.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();

          var isOpen = subMenu.classList.contains('open');

          if (isOpen) {
            subMenu.classList.remove('open');
            title.classList.remove('expanded');
          } else {
            subMenu.classList.add('open');
            title.classList.add('expanded');
          }
        });
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSidebarAccordion);
  } else {
    initSidebarAccordion();
  }
})();
