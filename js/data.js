/*	Author: 	Kyle Foreman (kforeman@post.harvard.edu)
	Date:		12 Feb 2012
	Purpose:	Return requested data, loading it if necessary
*/

// objects in which to store the data, nested by geo, sex, cause
	var data = {},
		meta_data = {},
		pop_env_data = {},
		model_results = {},
		model_ages = {},
		model_years = {},
		loaded_data = {},
		loaded_meta_data = {},
		loaded_pop_env_data = {},
		loaded_model_results = {};
	geo_list.map(function(g) {
		data[g.code] = {};
		pop_env_data[g.code] = {};
		model_results[g.code] = {};
		[1, 2].map(function(s) {
			data[g.code][s] = {};
			pop_env_data[g.code][s] = {};
			years.map(function(y) {
				pop_env_data[g.code][s][y] = {};
			});
			cause_list.map(function(c) {
				data[g.code][s][c.cause_viz] = [];
			});
		});
	});

// function to retrieve set of cause fractions for a country/sex/cause
	function retrieve_cause_fractions(geo, sex, cause) {
		
		// download the data if it hasn't been already
			if (loaded_data[geo + '_' + sex + '_' + cause] != 1) download_data(geo, sex, cause);
		
		// if it's a whole region, loop through its countries
			if (geo.substr(0,2) == 'R_') {
				var tmp = [];
				regions[geo.substr(2)].map(function(g) {
					data[g][sex][cause].map(function(d) {
						tmp.push(d);
					});
				});
			}
		
		// otherwise just pick the country
			else var tmp = data[geo][sex][cause];
		
		// return the requested data
			if (typeof tmp == 'undefined') return [];
			else return tmp;
	}
	


// ----------- NOTE: instead of the json.map() below for regions, let's implement a loop through the countries, doing separate AJAX requests for each (instead of requesting them all at once and then going through the trouble of parsing everything) ------------ //





// load data by geo/sex/cause
	function download_data(geo, sex, cause) {
		$.ajax({
			url: 		'php/data.php?geo=' + geo + '&sex=' + sex + '&cause=' + cause.replace(/_/g, '.'),
			dataType: 	'json',
			async: 		false,
			success:	function(json) {
				if (geo.substr(0,2) == 'R_') {
					json.map(function(d) {
						if (typeof data[d.geo] == 'undefined') {
							data[d.geo] = {};
							data[d.geo][sex] = {};
						}
						if (typeof data[d.geo][sex][cause] == 'undefined') data[d.geo][sex][cause] = [];
						if (d.year >= start_year) data[d.geo][sex][cause].push(d);
						if (geo.substr(0,2) == 'R_' && loaded_data[d.geo + '_' + sex + '_' + cause] != 1) loaded_data[d.geo + '_' + sex + '_' + cause] = 1;
					});
				}
				else data[geo][sex][cause] = json.filter(function(d) {
					 return d.year >= start_year;
				});
				loaded_data[geo + '_' + sex + '_' + cause] = 1;
			}
		});		
	}

// retrieve meta data for a given study
	function retrieve_meta_data(source_id, geo) {
		
		// download the meta data for this country if it hasn't already been cached
			if (loaded_meta_data[geo] != 1) download_meta_data(geo);
		
		// return the meta data for the specified study
			return meta_data[source_id];
	}

// download meta data for a given country
	function download_meta_data(geo) {
		$.ajax({
			url: 		'php/meta_data.php?geo=' + geo,
			dataType: 	'json',
			async: 		false,
			success: 	function(json) {
				json.map(function(d) {
					meta_data[d.source_id] = d;
				});
				loaded_meta_data[geo] = 1;
			}
		});
	}

// retrieve population/envelope for a given country/sex/age/year
	function retrieve_pop_env(geo, sex, age, year) {
		
		// download the data for this country/sex if it hasn't been already
			if (loaded_pop_env_data[geo + '_' + sex] != 1) download_pop_env_data(geo, sex);
		
		// return the envelope and population
			return pop_env_data[geo][sex][year][age];
	}

// download population/envelope data for a country/sex
	function download_pop_env_data(geo, sex) {
		$.ajax({
			url: 		'php/pop_env.php?geo=' + geo + '&sex=' + sex,
			dataType: 	'json',
			async: 		false,
			success: 	function(json) {
				json.map(function(d) {
					if (typeof pop_env_data[d.geo][sex][d.year] != 'undefined') pop_env_data[d.geo][sex][d.year][d.age] = { pop: parseInt(d.pop), env: parseFloat(d.envelope), env_corr: parseFloat(d.env_corr) };
					if (loaded_pop_env_data[d.geo + '_' + sex] != 1) loaded_pop_env_data[d.geo + '_' + sex] = 1;
				});
			}
		});
	}

// method to find unique values of an array
	Array.prototype.getUnique = function(){
   		var u = {}, a = [];
   		for(var i = 0, l = this.length; i < l; ++i){
      		if(this[i] in u)
         		continue;
      		a.push(this[i]);
      		u[this[i]] = 1;
   		}
   		return a;
	}

// retrieve model results
	function retrieve_model_results(model_number, corrected, geo) {
		if (loaded_model_results[geo + '_' + model_number + '_' + corrected] != 1) download_model_results(model_number, corrected, geo);
		return model_results[geo][model_number + '_' + corrected];
	}

// download model results
	function download_model_results(model_number, corrected, geo) {
		$.ajax({
			url:		'php/model_results.php?geo=' + geo + '&model_number=' + model_number + '&corrected=' + corrected,
			dataType:	'json',
			async:		false,
			success: 	function(json) {
				model_results[geo][model_number + '_' + corrected] = {};
				var age_tmp = [],
					year_tmp = [];
				json.map(function(d) {
					// make an object in which to hold this data if it hasn't been created already
						if (typeof model_results[geo][model_number + '_' + corrected][d.year] == 'undefined') model_results[geo][model_number + '_' + corrected][d.year] = {};
					// save the results
						model_results[geo][model_number + '_' + corrected][d.year][d.age] = { mean: parseFloat(d.mean), upper: parseFloat(d.upper), lower: parseFloat(d.lower) };
					// add to the list of which ages/years are available for this cause (exclude ages which only exist for 1990/2005/2010, because they're an artifact of how Mike or Tommy or whomever squares up the dataset)
						if (d.year != 1990 && d.year != 2005 && d.year != 2010) age_tmp.push(parseFloat(d.age));
						year_tmp.push(parseInt(d.year));
				});
				// mark this data as loaded
					loaded_model_results[geo + '_' + model_number + '_' + corrected] = 1;
				// list the ages/years available for this model
					model_ages[model_number + '_' + corrected] = age_tmp.getUnique().sort(function(a,b) { return a-b; });
					model_years[model_number + '_' + corrected] = year_tmp.getUnique().sort(function(a,b) { return a-b; });
			}
		});
	}
