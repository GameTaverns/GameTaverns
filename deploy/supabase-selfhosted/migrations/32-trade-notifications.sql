-- =============================================================================
-- GameTaverns Self-Hosted: Trade Notifications & Realtime
-- Migration: 32-trade-notifications.sql
-- Adds notification triggers for trade offers and realtime support
-- =============================================================================

-- Add decline_reason column to trade_offers
ALTER TABLE public.trade_offers ADD COLUMN IF NOT EXISTS decline_reason TEXT;

-- ===========================================
-- Trade Offer Created Notification Trigger
-- ===========================================
CREATE OR REPLACE FUNCTION public.notify_on_trade_offer_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    offerer_name TEXT;
    game_title TEXT;
    listing_game_id UUID;
BEGIN
    SELECT display_name INTO offerer_name
    FROM public.user_profiles WHERE user_id = NEW.offering_user_id;

    SELECT tl.game_id INTO listing_game_id
    FROM public.trade_listings tl WHERE tl.id = NEW.offering_listing_id;

    IF listing_game_id IS NOT NULL THEN
        SELECT title INTO game_title FROM public.games WHERE id = listing_game_id;
    END IF;

    PERFORM public.create_notification(
        NEW.receiving_user_id,
        'trade_offer_received',
        COALESCE(offerer_name, 'Someone') || ' sent you a trade offer',
        '"' || COALESCE(game_title, 'Unknown Game') || '"',
        jsonb_build_object('offer_id', NEW.id)
    );

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_on_trade_offer_created_trigger ON public.trade_offers;
CREATE TRIGGER notify_on_trade_offer_created_trigger
    AFTER INSERT ON public.trade_offers
    FOR EACH ROW
    EXECUTE FUNCTION public.notify_on_trade_offer_created();

-- ===========================================
-- Trade Offer Status Change Notification Trigger
-- ===========================================
CREATE OR REPLACE FUNCTION public.notify_on_trade_offer_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    responder_name TEXT;
    game_title TEXT;
    listing_game_id UUID;
BEGIN
    IF OLD.status = NEW.status THEN
        RETURN NEW;
    END IF;

    SELECT tl.game_id INTO listing_game_id
    FROM public.trade_listings tl WHERE tl.id = NEW.offering_listing_id;

    IF listing_game_id IS NOT NULL THEN
        SELECT title INTO game_title FROM public.games WHERE id = listing_game_id;
    END IF;

    IF NEW.status = 'accepted' THEN
        SELECT display_name INTO responder_name
        FROM public.user_profiles WHERE user_id = NEW.receiving_user_id;

        PERFORM public.create_notification(
            NEW.offering_user_id,
            'trade_offer_accepted',
            COALESCE(responder_name, 'Someone') || ' accepted your trade offer!',
            '"' || COALESCE(game_title, 'Unknown Game') || '"',
            jsonb_build_object('offer_id', NEW.id)
        );

    ELSIF NEW.status = 'declined' THEN
        SELECT display_name INTO responder_name
        FROM public.user_profiles WHERE user_id = NEW.receiving_user_id;

        PERFORM public.create_notification(
            NEW.offering_user_id,
            'trade_offer_declined',
            COALESCE(responder_name, 'Someone') || ' declined your trade offer',
            CASE
                WHEN NEW.decline_reason IS NOT NULL AND NEW.decline_reason != ''
                THEN '"' || COALESCE(game_title, 'Unknown Game') || '" — ' || NEW.decline_reason
                ELSE '"' || COALESCE(game_title, 'Unknown Game') || '"'
            END,
            jsonb_build_object('offer_id', NEW.id)
        );
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_on_trade_offer_status_change_trigger ON public.trade_offers;
CREATE TRIGGER notify_on_trade_offer_status_change_trigger
    AFTER UPDATE ON public.trade_offers
    FOR EACH ROW
    EXECUTE FUNCTION public.notify_on_trade_offer_status_change();

-- ===========================================
-- Add trade_offers to realtime publication
-- ===========================================
DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.trade_offers;
    EXCEPTION WHEN duplicate_object THEN
        RAISE NOTICE 'trade_offers already in supabase_realtime publication';
    END;
END $$;
