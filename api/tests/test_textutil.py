from app.textutil import (clean_prompt, contains_blocked, cut_after_sentences,
                          is_word_token, join_text, split_fragment)


def test_clean_prompt_removes_controls_and_collapses_space():
    assert clean_prompt("kal\x00  main\n\noffice‮") == "kal main office"


def test_clean_prompt_keeps_trailing_space_signal():
    assert clean_prompt("kal main ") == "kal main "
    assert clean_prompt("kal main") == "kal main"


def test_split_fragment():
    assert split_fragment("kal main off") == ("kal main", "off")
    assert split_fragment("kal main ") == ("kal main", "")
    assert split_fragment("kal main,") == ("kal main,", "")
    assert split_fragment("hello") == ("", "hello")


def test_is_word_token():
    assert is_word_token("hai")
    assert not is_word_token("[EOS]")
    assert not is_word_token("##ing")
    assert not is_word_token("...")
    assert not is_word_token("  ")
    assert not is_word_token("12")


def test_cut_after_sentences():
    assert cut_after_sentences("a hai. b hai. c", 1) == "a hai."
    assert cut_after_sentences("a hai. b hai. c", 2) == "a hai. b hai."
    assert cut_after_sentences("no end here", 1) == "no end here"


def test_join_text():
    assert join_text("kal main", "office jaunga") == "kal main office jaunga"
    assert join_text("kal main ", ", theek hai") == "kal main, theek hai"
    assert join_text("kal main", "") == "kal main"


def test_blocklist_matches_whole_words_only():
    assert contains_blocked("you are bad", ("bad",))
    assert not contains_blocked("badminton khelo", ("bad",))
    assert not contains_blocked("anything", ())
