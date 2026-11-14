// static/logic.js
"use strict";

// ---------------------------------------------------------------------------
// Utilitários matemáticos
// ---------------------------------------------------------------------------

function mjd_to_aarondate(mjd) {
    var d = new Date(-3506716800000 + (mjd * 86400000));
    return d.getFullYear() + "." + (d.getMonth() / 12.0).toFixed(1).substring(2);
}

function symlog10(x) {
    if (x === 0) return 0;
    return x < 0 ? -Math.log10(-x) : Math.log10(x);
}

function symexp10(x) {
    if (x === 0) return 0;
    return x < 0 ? -(10 ** (-x)) : 10 ** x;
}

// ---------------------------------------------------------------------------
// Cache LRU simples
// ---------------------------------------------------------------------------

function Memoizer(size) {
    this.size  = size;
    this.keys  = [];
    this.cache = {};

    this.key = function () { return JSON.stringify(arguments); };

    this.add = function (k, v) {
        this.cache[k] = v;
        this.keys.push(k);
        if (this.keys.length > this.size) {
            delete this.cache[this.keys.shift()];
        }
    };

    this.get = function (k) { return this.cache[k]; };
}

// ---------------------------------------------------------------------------
// Slider com escala logarítmica simétrica
// ---------------------------------------------------------------------------

function ComplicatedSlider(name) {
    var that = this;
    this.name = name;
    this.elem = jQuery("#" + this.name + "Input");

    this.elem.slider({
        range: true, min: 0.0, max: 100.0, values: [0.0, 100.0],
        slide: function (event, ui) {
            that.minbright = symexp10(ui.values[0]);
            that.maxbright = symexp10(ui.values[1]);
            jQuery("#" + that.name + "Value").text(
                Math.round(symexp10(ui.values[0])) + " - " +
                Math.round(symexp10(ui.values[1]))
            );
        }
    });

    this.update_limits = function (min, max) {
        this.elem.slider("option", "min",  symlog10(min));
        this.elem.slider("option", "max",  symlog10(max));
        this.elem.slider("option", "step",
            (Math.abs(symlog10(max)) + Math.abs(symlog10(min))) / 1000.0);
    };

    this.update_values = function (low, high) {
        var l = parseFloat(low), h = parseFloat(high);
        this.elem.slider("option", "values", [symlog10(l), symlog10(h)]);
        jQuery("#" + this.name + "Value").text(Math.round(l) + " - " + Math.round(h));
    };

    this.low      = function () { return this.elem.slider("option", "values")[0]; };
    this.high     = function () { return this.elem.slider("option", "values")[1]; };
    this.disable  = function () { return this.elem.slider("disable"); };
    this.enable   = function () { return this.elem.slider("enable"); };
}

// ---------------------------------------------------------------------------
// WiseSwapper  (nome histórico mantido; agora suporta qualquer missão)
// ---------------------------------------------------------------------------

function WiseSwapper() {
    var that = this;

    this.overlay_scale = 10;
    this.border_width  = 3;
    this.coadd_cache   = new Memoizer(32);

    // Configurações por missão: bandas e rótulos de exibição.
    // Populadas dinamicamente via GET /missions ao inicializar.
    this.mission_config = {};

    // -----------------------------------------------------------------------
    // Estado local reiniciável
    // -----------------------------------------------------------------------

    this.reset_locals = function () {
        this.versions          = [];
        this.epoch_legend      = [];
        this.window_epochs     = [];
        this.window_antiepochs = [];
        this.global_mjds       = [];
        this.window_mjds       = [];
        this.ims               = [];
        this.images            = [];
        this.overlays          = {};
        this.overlays_enable   = {};
        this.canvas_mouse      = {
            down: false, drawing: false,
            x: 0, y: 0, startX: 0, startY: 0, sep: 0
        };
    };

    this.reset_locals();

    // -----------------------------------------------------------------------
    // Elementos de UI
    // -----------------------------------------------------------------------

    this.container      = jQuery("#image");
    this.loc_input      = jQuery("#locInput");
    this.size_input     = jQuery("#sizeInput");
    this.band_input     = jQuery("#bandInput");
    this.mission_input  = jQuery("#missionInput");

    this.linear_input = jQuery("#linearInput");
    this.linear_input.slider({
        min: 0.0, max: 1.0, step: 0.001, value: 1.0,
        slide: function (event, ui) {
            jQuery("#linearValue").text(ui.value.toFixed(4));
        }
    });

    this.update_linear_input = function (v) {
        this.linear_input.slider("option", "value", v);
        jQuery("#linearValue").text(v.toFixed(3));
    };

    this.trimbright = new ComplicatedSlider("trimbright");

    this.window_input = jQuery("#windowInput");
    this.window_input.slider({
        min: 0.0, max: 10.0, value: 0.0,
        slide: function (event, ui) {
            jQuery("#windowValue").text(ui.value.toFixed(2));
        }
    });

    this.diff_window_input = jQuery("#diffWindowInput");
    this.diff_window_input.slider({
        min: 0.0, max: 10.0, value: 0.0,
        slide: function (event, ui) {
            jQuery("#diffWindowValue").text(ui.value.toFixed(2));
        }
    });

    this.speed_input = jQuery("#speedInput");
    this.speed_input.slider({
        min: 20.0, max: 1000.0, value: 500.0,
        slide: function (event, ui) {
            jQuery("#speedValue").text(Math.round(ui.value));
            that.updateSpeed();
        }
    });

    this.zoom_input = jQuery("#zoomInput");
    this.zoom_input.slider({
        min: 0.5, max: 20.0, value: 9.0,
        slide: function (event, ui) {
            jQuery("#zoomValue").text(ui.value.toFixed(1));
            that.updateZoom(ui.value);
        }
    });

    this.ver_output  = jQuery("#verValue");
    this.canvas      = jQuery("#daCanvas");
    this.context     = this.canvas.get(0).getContext("2d");
    this.over_canvas = jQuery("#overlayCanvas");
    this.over_context = this.over_canvas.get(0).getContext("2d");

    this.border_input        = jQuery("#borderInput");
    this.gaia_input          = jQuery("#gaiaInput");
    this.invert_input        = jQuery("#invertInput");
    this.maxdyr_input        = jQuery("#maxdyrInput");
    this.scandir_input       = jQuery("#scandirInput");
    this.neowise_only_input  = jQuery("#neowiseOnlyInput");
    this.diff_input          = jQuery("#diffInput");
    this.outer_epochs_input  = jQuery("#outerEpochsInput");
    this.unique_windows_input = jQuery("#uniqueWindowInput");
    this.smooth_scan_input   = jQuery("#smoothScanInput");

    // -----------------------------------------------------------------------
    // Carregamento dinâmico de missões a partir do backend (/missions)
    // -----------------------------------------------------------------------

    /**
     * Busca as missões e bandas disponíveis no backend e popula os <select>s.
     * Chame isso uma vez na inicialização antes de fromUrl().
     */
    this.loadMissions = function (callback) {
        jQuery.getJSON("/missions", function (data) {
            var missionSel = that.mission_input;
            missionSel.empty();

            (data.missions || []).forEach(function (m) {
                that.mission_config[m.name] = m.bands;
                var label = m.name.toUpperCase();
                missionSel.append(
                    jQuery("<option>").val(m.name).text(label)
                );
            });

            // Atualiza as bandas da missão atualmente selecionada
            that.updateBandOptions(missionSel.val());

            if (typeof callback === "function") callback();
        }).fail(function () {
            // Fallback: se /missions falhar, mantém o HTML estático
            console.warn("Não foi possível carregar /missions; usando opções estáticas.");
            if (typeof callback === "function") callback();
        });
    };

    /**
     * Atualiza o <select id="bandInput"> com as bandas da missão `missionName`.
     */
    this.updateBandOptions = function (missionName) {
        var bands = this.mission_config[missionName];
        if (!bands || bands.length === 0) return;

        var bandSel = this.band_input;
        var current = bandSel.val();
        bandSel.empty();

        bands.forEach(function (b, idx) {
            var opt = jQuery("<option>").val(idx + 1).text(b);
            if (b === current || idx + 1 === parseInt(current)) {
                opt.prop("selected", true);
            }
            bandSel.append(opt);
        });
    };

    // -----------------------------------------------------------------------
    // Controle de velocidade / zoom / URL
    // -----------------------------------------------------------------------

    this.updateSpeed = function () {
        clearInterval(this.interval);
        this.interval = setInterval(
            this.frame.bind(this),
            +this.speed_input.slider("option", "value")
        );
        this.updateUrl();
    };

    this.buildUrl = function (ra, dec, size, zoom, diff) {
        if (size === undefined || size === null)
            size = this.size_input.val();
        if (zoom === undefined || zoom === null)
            zoom = this.zoom_input.slider("option", "value");
        if (diff === undefined || diff === null)
            diff = this.diff_input.prop("checked") ? 1 : 0;

        return jQuery.param({
            mission: this.mission_input.val() || "wise",
            ra:      ra,
            dec:     dec,
            size:    size,
            band:    this.band_input.val(),
            speed:   this.speed_input.slider("option", "value"),
            minbright: symexp10(this.trimbright.low()).toFixed(4),
            maxbright: symexp10(this.trimbright.high()).toFixed(4),
            zoom:    zoom,
            diff:    diff,
        });
    };

    this.updateUrl = function () {
        var loc = this.parseLoc();
        if (loc !== null) {
            window.location.hash = this.buildUrl(loc[0], loc[1]);
        }
    };

    this.updateZoom = function (zoom) {
        if (!this.real_img_size) {
            var fov  = this.size_input.val();
            var zm   = this.zoom_input.slider("option", "value");
            jQuery("#pawnstars img").width((fov / 2.75) * zm).height((fov / 2.75) * zm);
            return;
        }
        this.canvas.attr("width",  this.real_img_size[0])
                   .attr("height", this.real_img_size[1]);
        this.over_canvas.attr("width",  this.real_img_size[0] * this.overlay_scale)
                        .attr("height", this.real_img_size[1] * this.overlay_scale);

        if (zoom === undefined)
            zoom = this.zoom_input.slider("option", "value");

        this.canvas.css("width",  this.real_img_size[0] * zoom)
                   .css("height", this.real_img_size[1] * zoom);
        this.over_canvas.css("width",  this.real_img_size[0] * zoom)
                        .css("height", this.real_img_size[1] * zoom);
    };

    this.update_speed_input = function (v) {
        this.speed_input.slider("option", "value", v);
        jQuery("#speedValue").text(Math.round(v));
    };

    this.update_zoom_input = function (v) {
        this.zoom_input.slider("option", "value", v);
        jQuery("#zoomValue").text(v.toFixed(1));
    };

    this.updateWindowValue = function (v) {
        this.window_input.slider("option", "value", v);
        jQuery("#windowValue").text(v.toFixed(2));
    };

    this.updateDiffWindowValue = function (v) {
        this.diff_window_input.slider("option", "value", v);
        jQuery("#diffWindowValue").text(v.toFixed(2));
    };

    // -----------------------------------------------------------------------
    // Pawnstars (Pan-STARRS preview) e Zooniverse
    // -----------------------------------------------------------------------

    this.updatePawnstars = function () {
        var loc = this.parseLoc();
        if (loc === null) return;

        jQuery.getJSON("/pawnstars", {
            ra:   loc[0],
            dec:  loc[1],
            size: this.size_input.val() * 4
        }, function (response) {
            var img = document.createElement("img");
            img.setAttribute("src", response);
            jQuery("#pawnstars").empty().append(img);
            that.updateZoom();
        });
    };

    this.updateZooiSubjects = function () {
        var loc = this.parseLoc();
        if (loc === null) return;

        jQuery.getJSON("/xref", { ra: loc[0], dec: loc[1] }, function (response) {
            var zs = jQuery("#zooiSubjects");
            zs.empty();
            if (response["ids"] && response["ids"].length > 0) {
                response["ids"].forEach(function (v) {
                    var a = document.createElement("a");
                    a.setAttribute("href",
                        "https://www.zooniverse.org/projects/marckuchner/backyard-worlds-planet-9/talk/subjects/" + v);
                    a.innerText = v;
                    zs.append(a);
                });
            } else {
                zs.append(document.createTextNode("None"));
            }
        });
    };

    // -----------------------------------------------------------------------
    // Defaults / URL parsing
    // -----------------------------------------------------------------------

    this.__setDefaults = function () {
        this.update_linear_input(1.0);
        this.minbright = "-50px";
        this.maxbright = "500px";
        this.trimbright.update_values(this.minbright, this.maxbright);
        this.updateWindowValue(0.75);
        this.updateDiffWindowValue(0);
    };

    this.setDefaults = function () {
        this.__setDefaults();
        this.update_zoom_input(9);
        this.restart();
    };

    this.fromUrl = function () {
        var raw = window.location.hash.substr(1);
        var map = {};
        raw.split("&").forEach(function (kv) {
            var s = kv.split("=");
            map[s[0]] = s[1];
        });

        this.loc_input.val(
            (map.ra && map.dec)
                ? unescape(map.ra) + " " + unescape(map.dec)
                : "133.786245 -7.244372"
        );

        this.size_input.val(map.size || 176);
        this.band_input.val(map.band || 2);

        // Restaura a missão da URL e atualiza as bandas correspondentes
        if (map.mission && this.mission_input.find("option[value='" + map.mission + "']").length) {
            this.mission_input.val(map.mission);
        }
        this.updateBandOptions(this.mission_input.val());

        this.update_speed_input(Number(map.speed) || 500);
        this.update_linear_input(Number(map.linear) || 1.0);
        this.update_zoom_input(Number(map.zoom) || 9);

        this.restart();
    };

    this.parseLoc = function () {
        var loc = unescape(this.loc_input.val());
        var hms = /([0-9]{1,2})[ :h]([0-9]{1,2})[ :m]([0-9\.]+)[s]{0,1}[ \t]*([-+]{0,1})[ \t]*([0-9]{1,2})[ :d]([0-9]{1,2})[ :m]([0-9\.]+)[ s]*/g.exec(loc);
        var deg = /([0-9\.]+).*?([+\-]{0,1}[0-9\.]+)/g.exec(loc);

        if (hms !== null) {
            var ra  = (parseFloat(hms[1]) / 24) * 360
                    + (parseFloat(hms[2]) / 60) * (360 / 24)
                    + (parseFloat(hms[3]) / 3600) * (360 / 24);
            var dec = parseFloat(hms[5]) + parseFloat(hms[6]) / 60 + parseFloat(hms[7]) / 3600;
            if (hms[4] === "-") dec = -dec;
            return [ra, dec];
        } else if (deg !== null) {
            return [parseFloat(deg[1].trim()), parseFloat(deg[2].trim())];
        }
        return null;
    };

    // -----------------------------------------------------------------------
    // Ciclo de renderização
    // -----------------------------------------------------------------------

    this.reset = function () {
        clearInterval(this.interval);
        this.reset_locals();
        this.cur_img = NaN;
        jQuery("#pawnstars").empty();
    };

    this.advance = function () {
        if (this.images.length === 0) return;
        if (isNaN(this.cur_img)) this.cur_img = 0;
        else this.cur_img = (this.cur_img + 1) % this.images.length;

        this.ver_output.text(this.versions[this.cur_img]);
        jQuery("#epoch-legend").text(this.epoch_legend[this.cur_img]);
    };

    this.draw = function () {
        if (!isNaN(this.cur_img)) {
            var image = this.images[this.cur_img];
            this.context.drawImage(image, 0, 0);
            this.over_context.clearRect(
                0, 0,
                this.over_canvas.width()  * this.overlay_scale,
                this.over_canvas.height() * this.overlay_scale
            );
            for (var ovr in this.overlays) {
                if (this.overlays[ovr].length === this.images.length &&
                    this.overlays_enable[ovr]) {
                    this.over_context.putImageData(this.overlays[ovr][this.cur_img], 0, 0);
                }
                break;
            }
        }
    };

    // -----------------------------------------------------------------------
    // Busca de imagens no backend
    // -----------------------------------------------------------------------

    /**
     * 1. Chama GET /tiles para obter metadados (coadd_id, epoch, band).
     * 2. Para cada epoch, chama GET /cutout e carrega a imagem resultante.
     *
     * Funciona de forma idêntica para WISE e SPHEREx — a diferença é tratada
     * inteiramente pelo backend via MissionRegistry.
     */
    this.get_cutouts = function (ra, dec, size, band) {
        var mission = this.mission_input.val() || "wise";

        jQuery.ajax({
            url:      "/tiles",
            datatype: "json",
            data:     { mission: mission, ra: ra, dec: dec, size: size, band: band },
            success:  function (meta) {
                if (meta.tiles && meta.tiles.length > 0) {
                    that._fetch_cutout_images(meta.tiles, ra, dec, size, mission);
                }
                that.unblock();
            },
            error: function (xhr, status, err) {
                that.unblock();
                console.error("Erro ao carregar tiles:", err);
            }
        });
    };

    this._fetch_cutout_images = function (tiles, ra, dec, size, mission) {
        tiles.forEach(function (tile) {
            tile.epochs.forEach(function (ep) {
                jQuery.getJSON("/cutout", {
                    mission:  mission,
                    coadd_id: tile.coadd_id,
                    epoch:    ep.epoch,
                    band:     ep.band,
                    ra:       ra,
                    dec:      dec,
                    size:     size,
                }, function (resp) {
                    if (!resp.image) return;
                    var img = document.createElement("img");
                    img.setAttribute("src", resp.image);
                    jQuery(img).on("load", function () {
                        that.real_img_size = [this.width, this.height];
                        that.updateZoom();
                    });
                    that.images.push(img);
                    that.versions.push(
                        mission.toUpperCase() + " " + tile.coadd_id +
                        " ep" + ep.epoch + " b" + ep.band
                    );
                    that.epoch_legend.push(mjd_to_aarondate(ep.mjdmean));
                });
            });
        });
    };

    // -----------------------------------------------------------------------
    // Bloqueio / desbloqueio de UI
    // -----------------------------------------------------------------------

    this.block = function () {
        jQuery("#nav-left").block({ message: null, fadein: 0, fadeout: 0 });
        jQuery("#image").block({ message: null, fadein: 0, fadeout: 0 });
    };

    this.unblock = function () {
        jQuery("#nav-left").unblock({ message: null, fadein: 0, fadeout: 0 });
        jQuery("#image").unblock({ message: null, fadein: 0, fadeout: 0 });
    };

    // -----------------------------------------------------------------------
    // Ponto de entrada do ciclo de visualização
    // -----------------------------------------------------------------------

    this.restart = function () {
        this.block();
        this.reset();
        var loc = this.parseLoc();
        if (loc === null) { this.unblock(); return; }
        this.updateUrl();

        var ra    = loc[0], dec = loc[1];
        var size  = ~~(this.size_input.val() / 2.75);
        var band  = this.band_input.val();

        this.trimbright.enable();
        this.get_cutouts(ra, dec, size, band);
        this.updatePawnstars();
        this.updateZooiSubjects();
        this.updateZoom();
        this.updateUrl();
        this.updateSpeed();
    };

    this.frame = function () {
        this.advance();
        this.draw();
    };
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

jQuery(function () {
    jQuery("form").submit(function (e) { e.preventDefault(); });

    var ws = new WiseSwapper();

    // 1. Carrega missões do backend → popula os <select>s → restaura URL
    ws.loadMissions(function () {
        ws.fromUrl();
    });

    // 2. Eventos de UI
    jQuery("#overlayCanvas").on("mouseup",   ws.move_up   ? ws.move_up.bind(ws)   : null);
    jQuery("#overlayCanvas").on("mousedown", ws.move_down ? ws.move_down.bind(ws) : null);

    jQuery(".urlers").on("change",  ws.updateUrl.bind(ws));
    jQuery(".resetters").on("change", ws.restart.bind(ws));

    // Ao trocar de missão: atualiza bandas disponíveis e reinicia
    jQuery("#missionInput").on("change", function () {
        ws.updateBandOptions(jQuery(this).val());
        ws.restart();
    });
});
