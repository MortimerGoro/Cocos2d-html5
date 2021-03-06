/**
 * License: see license.txt file.
 */

/// <reference path="../Point.ts"/>
/// <reference path="./Segment.ts"/>
/// <reference path="./SegmentLine.ts"/>
/// <reference path="./SegmentArc.ts"/>
/// <reference path="./SegmentCardinalSpline.ts"/>
/// <reference path="./SegmentQuadratic.ts"/>
/// <reference path="./SegmentBezier.ts"/>
/// <reference path="./ContainerSegment.ts"/>
/// <reference path="../../util/Debug.ts"/>
/// <reference path="../../locale/Locale.ts"/>

module cc.math.path {

    import Vector= cc.math.Vector;
    import Segment= cc.math.path.Segment;
    import SegmentLine = cc.math.path.SegmentLine;
    import SegmentArc = cc.math.path.SegmentArc;
    import SegmentCardinalSpline = cc.math.path.SegmentCardinalSpline;
    import Locale = cc.locale;
    import ContainerSegment = cc.math.path.ContainerSegment;

    /**
     * @class cc.math.path.SubPath
     * @extends cc.math.path.ContainerSegment
     * @classdesc
     *
     * A Subpath is an open or closed Collection of chained Segments.
     * A Segment will share its starting Point with the previous Segment's
     * last Point (or the initial movedTo point) and the final Point with the next Segment's starting Point.
     *
     * A SubPath is considered empty when it has no segments.
     * The length of the SubPath will be the lengths of all its Segments.
     * The results from a call to <code>getValueAt</code> will be proportional to all the Segments it contains.
     * The result from a call to <code>trace</code> will be points proportional to all the Segments it contains.
     * The result from a call to <code>getStartingPoint</code> will be the starting point of the first segment.
     *
     * A SubPath can be closed. When it is in this state, no new Segments can be added to it.
     *
     */
    export class SubPath extends ContainerSegment {

        /**
         * Path current tracing point. When adding segments to the path, this is the reference point.
         * @member cc.math.path.SubPath#_currentPoint
         * @type {cc.math.Vector}
         * @private
         */
        _currentPoint:Vector = null;
        
        /**
         * Is the path closed ? If so, more path tracing operations will require to build anothe SubPath.
         * @member cc.math.path.SubPath#_closed
         * @type {boolean}
         * @private
         */
        _closed:boolean = false;


        /**
         * Build a new SubPath instance.
         * @method cc.math.path.SubPath#constructor
         */
        constructor() {
            super();
        }

        /**
         * Whether the SubPath is closed.
         * @returns {boolean}
         */
        isClosed():boolean {
            return this._closed;
        }

        /**
         * Test whether the SubPath is empty, that is, tracing info has not been set yet.
         * @returns {boolean}
         */
        isEmpty():boolean {
            return this._currentPoint===null;
        }

        /**
         * Number of Segments contained in this SubPath.
         * If a Segment is actually another Path, it will count 1 segment.
         * @returns {number}
         */
        numSegments() : number {
            return this._segments.length;
        }

        /**
         * Add a Segment to the SubPath and set the Segment's parent as the SubPath.
         * @param s {cc.math.path.Segment}
         */
        addSegment( s : Segment ) : void {
            s.setParent( this );
            this._segments.push(s);
        }

        /**
         * Clear all sub-path data, and revert to the original path object status.
         * Make sure this path is not another's path segment.
         *
         * @method cc.math.path.SubPath#beginPath
         */
        beginPath(): SubPath {
            this._segments = [];
            this._length = 0;
            this._currentPoint = null;
            this._closed = false;

            return this;
        }

        /**
         * Move the current path tracer to a position.
         *
         * @method cc.math.path.SubPath#moveTo
         * @param x {number}
         * @param y {number}
         */
        moveTo(x:number, y:number): SubPath {

            if ( this._closed ) {
                cc.Debug.warn( locale.WARN_MOVETO_IN_NON_EMPTY_SUBPATH );
                return;
            }

            if ( null===this._currentPoint ) {
                this._currentPoint = new Vector();
            }

            if ( this.numSegments()===0 ) {
                this._currentPoint.x = x;
                this._currentPoint.y = y;
            }

            return this;
        }

        /**
         * Add a line to the current path.
         * If the current path is not initialized, in will be initialized from 0,0 and a line added.
         *
         * @method cc.math.path.SubPath#lineTo
         * @param x {number}
         * @param y {number}
         */
        lineTo(x:number, y:number): SubPath {

            if ( this._closed ) {
                cc.Debug.warn( locale.WARN_TRACE_ON_CLOSED_SUBPATH, "lineTo" );
                return;
            }

            if ( this.isEmpty() ) {

                this._currentPoint= new Vector();

            } else {

                this.addSegment(new SegmentLine({
                    start: {
                        x: this._currentPoint.x,
                        y: this._currentPoint.y
                    },
                    end: {
                        x: x,
                        y: y
                    }
                }));
            }

            this._currentPoint.x = x;
            this._currentPoint.y = y;

            return this;
        }

        /**
         * Add an arc to the SubPath.
         * An arc is defined by a position, a radius, an start and an end angle and how to traverse from the start to
         * the end angle, eg clock or counter clock wisely.
         * The arc will be the minimum angle between start and end angles.
         * Though not strictly necessary, this method expects the difference between startAngle and endAngle
         * to be <= 2*Math.PI
         * @see {cc.math.path.SegmentArc}
         * @method cc.math.path.SubPath#arc
         * @param x {number}
         * @param y {number}
         * @param radius {number}
         * @param startAngle {number} radians
         * @param endAngle {number} radians
         * @param anticlockwise
         * @param addLineTo {boolean} When adding an arc to a Path, if any SubPath is present a line must be added
         *  to the current SubPath. If true add a line from the current SubPath point to the starting point on the arc.
         * @returns {cc.math.path.SubPath}
         */
        arc( x:number, y:number, radius:number, startAngle:number, endAngle:number, anticlockwise:boolean, addLineTo?:boolean ) : SubPath {

            if ( this._closed ) {
                cc.Debug.warn( locale.WARN_TRACE_ON_CLOSED_SUBPATH, "ClosePath" );
                return;
            }

            var segment= new SegmentArc({
                x: x,
                y: y,
                radius : radius,
                startAngle : startAngle,
                endAngle : endAngle,
                ccw : anticlockwise
            });

            if ( addLineTo ) {

                var sp : Vector = segment.getStartingPoint();
                this.addSegment( new SegmentLine({
                    start : {
                        x: this._currentPoint.x,
                        y: this._currentPoint.y
                    },
                    end : {
                        x : sp.x,
                        y : sp.y
                    }
                }))
            }
            this.addSegment( segment );

            var fp : Vector= segment.getEndingPoint();
            this._currentPoint.set( fp.x, fp.y );
            this._dirty= true;

            return this;

        }

        /**
         * Close the SubPath.
         * If the SubPath was already closed, in DEBUG mode will show a console message. In either case, nothing happens.
         * If the SubPath is empty
         * @returns {cc.math.path.SubPath}
         */
        closePath() : SubPath {

            if ( this._closed ) {
                cc.Debug.warn( locale.WARN_TRACE_ON_CLOSED_SUBPATH, "ClosePath" );
                return;
            }

            if ( this.isEmpty() ) {
                cc.Debug.warn( locale.WARN_CLOSE_EMPTY_SUBPATH, "ClosePath" );
                return;
            }

            var p : Point = this.getStartingPoint();

            var segment : Segment = new SegmentLine({
                    start: { x: this._currentPoint.x, y: this._currentPoint.y },
                    end: { x: p.x, y: p.y }
                });

            this.addSegment(segment);

            this._currentPoint= segment.getEndingPoint();
            this._closed= true;
            this._dirty= true;

            return this;
        }


        /**
         * Get the SubPath's starting point.
         * It will return the original SubPath starting point, not a copy of it.
         * If this SubPath is empty (no points) an error is thrown if in DEBUG mode.
         * @returns {cc.math.Vector}
         */
        getStartingPoint() : Vector {

            if ( !this.isEmpty() ) {
                return this._segments.length ?
                    this._segments[0].getStartingPoint() :
                    this._currentPoint;
            }

            cc.Debug.error( locale.ERR_SUBPATH_NOT_STARTED, "getStartingPoint" );
        }

        /**
         * Get the SubPath's ending point.
         * It will return the original SubPath ending point, not a copy of it.
         * If this SubPath is empty (no points) an error is thrown if in DEBUG mode.
         * @returns {cc.math.Vector}
         */
        getEndingPoint() : Vector {
            if (!this.isEmpty()) {
                return this._segments.length ?
                    this._segments[ this._segments.length-1 ].getEndingPoint() :
                    this._currentPoint;
            }

            cc.Debug.error( locale.ERR_SUBPATH_NOT_STARTED, "getEndingPoint" );
        }

        clone() : SubPath {
            var sp=new SubPath();

            sp._closed= this._closed;

            for( var i=0; i<this._segments.length; i++ ) {
                sp._segments.push( this._segments[i].clone() );
            }

            sp._length= this._length;
            sp._currentPoint= this._currentPoint.clone();

            return sp;
        }

        quadraticTo( x0:number, y0:number, x1:number, y1:number ) {

            if ( this._closed ) {
                cc.Debug.warn(locale.WARN_TRACE_ON_CLOSED_SUBPATH, "lineTo");
                return this;
            }

            this.addSegment( new cc.math.path.SegmentQuadratic({
                p0: { x:this._currentPoint.x, y: this._currentPoint.y },
                p1: { x:x0, y:y0 },
                p2: { x:x1, y:y1 }
            }));

            this._currentPoint.x = x1;
            this._currentPoint.y = y1;

            return this;
        }

        bezierTo( x0:number, y0:number, x1:number, y1:number, x2:number, y2:number ) {

            if ( this._closed ) {
                cc.Debug.warn(locale.WARN_TRACE_ON_CLOSED_SUBPATH, "lineTo");
                return this;
            }

            this.addSegment( new cc.math.path.SegmentBezier({
                p0: { x:this._currentPoint.x, y: this._currentPoint.y },
                p1: { x:x0, y:y0 },
                p2: { x:x1, y:y1 },
                p3: { x:x2, y:y2 }
            }));

            this._currentPoint.x = x2;
            this._currentPoint.y = y2;

            return this;
        }

        catmullRomTo( x0:number, y0:number, x1:number, y1:number, x2:number, y2:number, tension:number ) {

            if ( this._closed ) {
                cc.Debug.warn(locale.WARN_TRACE_ON_CLOSED_SUBPATH, "lineTo");
                return this;
            }

            this.addSegment(new cc.math.path.SegmentCardinalSpline({
                p0: {
                    x: this._currentPoint.x,
                    y: this._currentPoint.y
                },
                cp0: {
                    x: x0,
                    y: y0
                },
                cp1: {
                    x: x1,
                    y: y1
                },
                p1: {
                    x: x2,
                    y: y2
                },
                tension:tension
            }));

            this._currentPoint.x = x0;
            this._currentPoint.y = y0;

            return this;
        }

        paint( ctx:cc.render.RenderingContext ) {

            ctx.beginPath();
            //ctx.strokeStyle="#000";
            for( var i=0; i<this._segments.length; i++ ) {
                this._segments[i].paint(ctx);
            }
            ctx.stroke();
        }

    }
}