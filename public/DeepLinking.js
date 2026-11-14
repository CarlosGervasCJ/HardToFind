
function updateBrowserUrl(ra, dec, band, radius){
	const urlParams = new UrlSearchParams(window.location.search);
	urlParams.set('ra', ra);
	urlParams.set('dec', dec);
	urlParams.set('band', band);
	urlParams.set('radius', radius);
	
	// Altera o histórico do browser sem recarregar a página
	const newPath = window.location.pathname + '?' + urlParams.toString();	
	history.pushState(null, '', newRelativePathQuery);
}
